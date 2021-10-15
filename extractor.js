//  node extractor.js --excel=WorldCup.csv --dataFolder=data --source=https://www.espncricinfo.com/series/icc-cricket-world-cup-2019-1144415/match-results

// npm init
// npm install minimist
// npm install axios
// npm install jsdom
// npm install excel4node
// npm install pdf-lib

let minimist = require("minimist");
let args = minimist(process.argv);
let axios = require("axios");
let jsdom = require("jsdom");
let excel = require("excel4node");
let pdf = require("pdf-lib");
let fs = require("fs");
let path = require("path");

let responsePrms = axios.get(args.source);
responsePrms.then(function (response) {
    let html = response.data;
    let dom = new jsdom.JSDOM(html);
    let document = dom.window.document;
    let matches = [];
    let matchScoreDivs = document.querySelectorAll("div.match-score-block");
    for (let i = 0; i < matchScoreDivs.length; i++) {
        let match = {};
        let teamDivs = matchScoreDivs[i].querySelectorAll("p.name");
        match.t1 = teamDivs[0].textContent;
        match.t2 = teamDivs[1].textContent;
        let scoreSpans = matchScoreDivs[i].querySelectorAll("div.score-detail > span.score");
        if (scoreSpans.length == 2) {
            match.t1s = scoreSpans[0].textContent
            match.t2s = scoreSpans[1].textContent
        } else if (scoreSpans.length == 1) {
            match.t1s = scoreSpans[0].textContent;
            match.t2s = "";
        } else {
            match.t1s = "";
            match.t2s = "";
        }
        let resultDiv = matchScoreDivs[i].querySelector("div.status-text > span");
        match.result = resultDiv.textContent;
        matches.push(match);
    }
    let matchesJSON = JSON.stringify(matches);
    fs.writeFileSync("matches.json", matchesJSON, "utf-8");
    let teams = [];
    for (let i = 0; i < matches.length; i++) {
        populateTeams(teams, matches[i]);
    }

    for (let i = 0; i < matches.length; i++) {
        populateMatches(teams, matches[i]);
    }

    let teamsJSON = JSON.stringify(teams);
    fs.writeFileSync("teams.json", teamsJSON, "utf-8");
    createExcelFile(teams);
    createFolders(teams, args.dataFolder);
}).catch(function (err) {
    console.log(err);
})

function populateTeams(teams, match) {
    let team1idx = -1;
    for (let i = 0; i < teams.length; i++) {
        if (match.t1 == teams[i].name) {
            team1idx = i;
            break;
        }
    }
    if (team1idx == -1) {
        let team = {
            name: match.t1,
            matches: []
        }
        teams.push(team);
    }

    let team2idx = -1;
    for (let i = 0; i < teams.length; i++) {
        if (match.t2 == teams[i].name) {
            team2idx = i;
            break;
        }
    }
    if (team2idx == -1) {
        let team = {
            name: match.t2,
            matches: []
        }
        teams.push(team);
    }
}

function populateMatches(teams, match) {
    let team1idx = -1;
    for (let i = 0; i < teams.length; i++) {
        if (match.t1 == teams[i].name) {
            team1idx = i;
            break;
        }
    }
    let team1 = teams[team1idx];
    let matchDetail1 = {
        opponent: match.t2,
        selfScore: match.t1s,
        opponentScore: match.t2s,
        result: match.result
    }
    team1.matches.push(matchDetail1);

    let team2idx = -1;
    for (let i = 0; i < teams.length; i++) {
        if (match.t2 == teams[i].name) {
            team2idx = i;
            break;
        }
    }
    let team2 = teams[team2idx];
    let matchDetail2 = {
        opponent: match.t1,
        selfScore: match.t2s,
        opponentScore: match.t1s,
        result: match.result
    }
    team2.matches.push(matchDetail2);
}

function createExcelFile(teams) {
    let wb = new excel.Workbook();
    let style = wb.createStyle({
        font: {
            color: '#000000',
            size: 12,
            bold : true
        },
        numberFormat: '$#,##0.00; ($#,##0.00); -',
        fill: {
            type: "pattern",
            patternType: "solid",
            fgColor: "#FFA500"
        }
    });
    for (let i = 0; i < teams.length; i++) {
        let sheet = wb.addWorksheet(teams[i].name);
        sheet.cell(1, 1).string("Opponent").style(style);
        sheet.cell(1, 2).string("Self Score").style(style);
        sheet.cell(1, 3).string("Opponent Score").style(style);
        sheet.cell(1, 4).string("Result").style(style);

        for (let j = 0; j < teams[i].matches.length; j++) {
            sheet.cell(2 + j, 1).string(teams[i].matches[j].opponent);
            sheet.cell(2 + j, 2).string(teams[i].matches[j].selfScore);
            sheet.cell(2 + j, 3).string(teams[i].matches[j].opponentScore);
            sheet.cell(2 + j, 4).string(teams[i].matches[j].result);
        }
    }
    wb.write(args.excel);
}


function createFolders(teams, dataFolder) {
    if (fs.existsSync(dataFolder) == true) {
        fs.rmdirSync(dataFolder, { recursive: true });
    }
    fs.mkdirSync(args.dataFolder);
    for (let i = 0; i < teams.length; i++) {
        let teamsFolder = path.join(args.dataFolder, teams[i].name);
        fs.mkdirSync(teamsFolder);
        for (let j = 0; j < teams[i].matches.length; j++) {
            let matchFileName = path.join(teamsFolder, teams[i].matches[j].opponent);
            createScoreCard(teams[i].name, teams[i].matches[j], matchFileName);
        }
    }
}

function createScoreCard(teamName, match, matchFileName) {
    let t1 = teamName;
    let t2 = match.opponent;
    let t1s = match.selfScore;
    let t2s = match.opponentScore;
    let result = match.result;

    let originalBytes = fs.readFileSync("Template.pdf");
    let pdfDocPrms = pdf.PDFDocument.load(originalBytes);
    pdfDocPrms.then(function (pdfDoc) {
        let page = pdfDoc.getPage(0);
        page.drawText(t1, {
            x: 430,
            y: 290,
            size: 16
        });
        page.drawText(t2, {
            x: 430,
            y: 253,
            size: 16
        });
        page.drawText(t1s, {
            x: 430,
            y: 218,
            size: 16
        });
        page.drawText(t2s, {
            x: 430,
            y: 183,
            size: 16
        });
        page.drawText(result, {
            x: 430,
            y: 110,
            size: 13
        });

        let pdfSavePrms = pdfDoc.save();
        pdfSavePrms.then(function (newBytes) {
            if (fs.existsSync(matchFileName + ".pdf") == true) {
                fs.writeFileSync(matchFileName + "(1).pdf", newBytes);
            } else {
                fs.writeFileSync(matchFileName + ".pdf", newBytes);
            }
        })
    })

}