const fs = require('fs');

function formatSecs(secs) {
    let isNeg = false;
    if (secs < 0) {
        isNeg = true;
        secs = secs * -1;
    }
    let h = Math.floor(secs / 3600);
    let m = Math.floor((secs % 3600) / 60);
    let s = secs % 60;
    let mStr = m.toString();
    if (m < 10) {
        mStr = "0" + mStr;
    }
    let sStr = s.toString();
    if (s < 10) {
        sStr = "0" + sStr;
    }
    let res = h + ":" + mStr + ":" + sStr;
    if (isNeg) {
        return "-" + res;
    }
    return res;
}

function parseAMPM(timeStr) {
    let spaceSplit = timeStr.split(" ");
    let timePart = spaceSplit[0];
    let ampmPart = spaceSplit[1];
    let colonSplit = timePart.split(":");
    let h = parseInt(colonSplit[0]);
    let m = parseInt(colonSplit[1]);
    let s = parseInt(colonSplit[2]);
    if (ampmPart == "pm") {
        if (h != 12) {
            h = h + 12;
        }
    }
    if (ampmPart == "am") {
        if (h == 12) {
            h = 0;
        }
    }
    let total = (h * 3600) + (m * 60) + s;
    return total;
}

function parseDuration(durStr) {
    let parts = durStr.split(":");
    let h = parseInt(parts[0]);
    let m = parseInt(parts[1]);
    let s = parseInt(parts[2]);
    return (h * 3600) + (m * 60) + s;
}

function getShiftDuration(startTime, endTime) {
    let s = parseAMPM(startTime);
    let e = parseAMPM(endTime);
    if (e < s) {
        e = e + (24 * 3600);
    }
    let diff = e - s;
    return formatSecs(diff);
}

function getIdleTime(startTime, endTime) {
    let s = parseAMPM(startTime);
    let e = parseAMPM(endTime);
    if (e < s) {
        e = e + (24 * 3600);
    }
    let idleSecs = 0;
    for (let i = s; i < e; i++) {
        let hourOfDir = i % (24 * 3600);
        if (hourOfDir < 28800) {
            idleSecs = idleSecs + 1;
        } else if (hourOfDir >= 79200) {
            idleSecs = idleSecs + 1;
        }
    }
    return formatSecs(idleSecs);
}

function getActiveTime(shiftDuration, idleTime) {
    let s = parseDuration(shiftDuration);
    let i = parseDuration(idleTime);
    let final = s - i;
    return formatSecs(final);
}

function metQuota(date, activeTime) {
    let actSecs = parseDuration(activeTime);
    let quota = (8 * 3600) + (24 * 60);
    if (date >= "2025-04-10") {
        if (date <= "2025-04-30") {
            quota = 6 * 3600;
        }
    }
    if (actSecs < quota) {
        return false;
    }
    return true;
}

function addShiftRecord(textFile, shiftObj) {
    let data = fs.readFileSync(textFile, "utf8");
    let lines = data.split("\n");
    let lastIndex = -1;
    let found = false;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        let cleanLine = line.trim();
        if (cleanLine == "") {
            continue;
        }
        let parts = cleanLine.split(",");
        let fDriverID = parts[0];
        let fDate = parts[2];
        if (fDriverID == shiftObj.driverID) {
            lastIndex = i;
            if (fDate == shiftObj.date) {
                found = true;
            }
        }
    }

    if (found == true) {
        return {};
    }

    let shiftD = getShiftDuration(shiftObj.startTime, shiftObj.endTime);
    let idleT = getIdleTime(shiftObj.startTime, shiftObj.endTime);
    let activeT = getActiveTime(shiftD, idleT);
    let quota = metQuota(shiftObj.date, activeT);

    shiftObj.shiftDuration = shiftD;
    shiftObj.idleTime = idleT;
    shiftObj.activeTime = activeT;
    shiftObj.metQuota = quota;
    shiftObj.hasBonus = false;

    let newLine = shiftObj.driverID + "," + shiftObj.driverName + "," + shiftObj.date + "," + shiftObj.startTime + "," + shiftObj.endTime + "," + shiftObj.shiftDuration + "," + shiftObj.idleTime + "," + shiftObj.activeTime + "," + shiftObj.metQuota + "," + shiftObj.hasBonus;

    let newLines =[];
    if (lastIndex == -1) {
        for (let i = 0; i < lines.length; i++) {
            let clean = lines[i].trim();
            if (clean != "") {
                newLines.push(clean);
            }
        }
        newLines.push(newLine);
    } else {
        for (let i = 0; i < lines.length; i++) {
            let clean = lines[i].trim();
            if (clean != "") {
                newLines.push(clean);
            }
            if (i == lastIndex) {
                newLines.push(newLine);
            }
        }
    }

    let outText = newLines.join("\n");
    fs.writeFileSync(textFile, outText);

    return shiftObj;
}

function setBonus(textFile, driverID, date, newValue) {
    let data = fs.readFileSync(textFile, "utf8");
    let lines = data.split("\n");
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        let cleanLine = line.trim();
        if (cleanLine == "") {
            continue;
        }
        let parts = cleanLine.split(",");
        if (parts[0] == driverID) {
            if (parts[2] == date) {
                parts[9] = newValue;
                lines[i] = parts.join(",");
            }
        }
    }
    let outText = lines.join("\n");
    fs.writeFileSync(textFile, outText);
}

function countBonusPerMonth(textFile, driverID, month) {
    let data = fs.readFileSync(textFile, "utf8");
    let lines = data.split("\n");
    let count = 0;
    let driverExists = false;
    let mStr = month.toString();
    if (mStr.length == 1) {
        mStr = "0" + mStr;
    }

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        let cleanLine = line.trim();
        if (cleanLine == "") {
            continue;
        }
        let parts = cleanLine.split(",");
        if (parts[0] == driverID) {
            driverExists = true;
            let d = parts[2];
            if (d != undefined) {
                let dateParts = d.split("-");
                if (dateParts[1] == mStr) {
                    if (parts[9] == "true") {
                        count = count + 1;
                    }
                }
            }
        }
    }

    if (driverExists == false) {
        return -1;
    }
    return count;
}

function getTotalActiveHoursPerMonth(textFile, driverID, month) {
    let data = fs.readFileSync(textFile, "utf8");
    let lines = data.split("\n");
    let totalSecs = 0;
    let mStr = month.toString();
    if (mStr.length == 1) {
        mStr = "0" + mStr;
    }

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        let cleanLine = line.trim();
        if (cleanLine == "") {
            continue;
        }
        let parts = cleanLine.split(",");
        if (parts[0] == driverID) {
            let d = parts[2];
            if (d != undefined) {
                let dateParts = d.split("-");
                if (dateParts[1] == mStr) {
                    let activeStr = parts[7];
                    let actSecs = parseDuration(activeStr);
                    totalSecs = totalSecs + actSecs;
                }
            }
        }
    }
    return formatSecs(totalSecs);
}

function getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month) {
    let rateData = fs.readFileSync(rateFile, "utf8");
    let rateLines = rateData.split("\n");
    let dayOff = "";
    for (let i = 0; i < rateLines.length; i++) {
        let line = rateLines[i];
        let cleanLine = line.trim();
        if (cleanLine == "") {
            continue;
        }
        let parts = cleanLine.split(",");
        if (parts[0] == driverID) {
            dayOff = parts[1];
        }
    }

    let offNum = -1;
    if (dayOff == "Sunday") offNum = 0;
    if (dayOff == "Monday") offNum = 1;
    if (dayOff == "Tuesday") offNum = 2;
    if (dayOff == "Wednesday") offNum = 3;
    if (dayOff == "Thursday") offNum = 4;
    if (dayOff == "Friday") offNum = 5;
    if (dayOff == "Saturday") offNum = 6;

    let data = fs.readFileSync(textFile, "utf8");
    let lines = data.split("\n");
    let totalSecs = 0;
    let mStr = month.toString();
    if (mStr.length == 1) {
        mStr = "0" + mStr;
    }

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        let cleanLine = line.trim();
        if (cleanLine == "") {
            continue;
        }
        let parts = cleanLine.split(",");
        if (parts[0] == driverID) {
            let d = parts[2];
            if (d != undefined) {
                let dateParts = d.split("-");
                if (dateParts[1] == mStr) {
                    let yyyy = parseInt(dateParts[0]);
                    let mm = parseInt(dateParts[1]) - 1;
                    let dd = parseInt(dateParts[2]);
                    let dateObj = new Date(yyyy, mm, dd);
                    let dayOfWeek = dateObj.getDay();

                    if (dayOfWeek != offNum) {
                        if (d >= "2025-04-10") {
                            if (d <= "2025-04-30") {
                                totalSecs = totalSecs + (6 * 3600);
                            } else {
                                totalSecs = totalSecs + (8 * 3600) + (24 * 60);
                            }
                        } else {
                            totalSecs = totalSecs + (8 * 3600) + (24 * 60);
                        }
                    }
                }
            }
        }
    }

    totalSecs = totalSecs - (bonusCount * 2 * 3600);
    if (totalSecs < 0) {
        totalSecs = 0;
    }

    return formatSecs(totalSecs);
}

function getNetPay(driverID, actualHours, requiredHours, rateFile) {
    let rateData = fs.readFileSync(rateFile, "utf8");
    let rateLines = rateData.split("\n");
    let basePay = 0;
    let tier = 0;

    for (let i = 0; i < rateLines.length; i++) {
        let line = rateLines[i];
        let cleanLine = line.trim();
        if (cleanLine == "") {
            continue;
        }
        let parts = cleanLine.split(",");
        if (parts[0] == driverID) {
            basePay = parseInt(parts[2]);
            tier = parseInt(parts[3]);
        }
    }

    let actSecs = parseDuration(actualHours);
    let reqSecs = parseDuration(requiredHours);

    if (actSecs >= reqSecs) {
        return basePay;
    }

    let missingSecs = reqSecs - actSecs;
    let allowedMissingHours = 0;

    if (tier == 1) {
        allowedMissingHours = 50;
    }
    if (tier == 2) {
        allowedMissingHours = 20;
    }
    if (tier == 3) {
        allowedMissingHours = 10;
    }
    if (tier == 4) {
        allowedMissingHours = 3;
    }

    let missingAfterAllowanceSecs = missingSecs - (allowedMissingHours * 3600);

    if (missingAfterAllowanceSecs <= 0) {
        return basePay;
    }

    let missingFullHours = Math.floor(missingAfterAllowanceSecs / 3600);
    let deductionRate = Math.floor(basePay / 185);
    let deduction = missingFullHours * deductionRate;

    let finalPay = basePay - deduction;
    return finalPay;
}

module.exports = {
    getShiftDuration,
    getIdleTime,
    getActiveTime,
    metQuota,
    addShiftRecord,
    setBonus,
    countBonusPerMonth,
    getTotalActiveHoursPerMonth,
    getRequiredHoursPerMonth,
    getNetPay
};