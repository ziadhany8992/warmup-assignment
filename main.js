const fs = require("fs");

function timeToSeconds(timeStr) {
    let parts = timeStr.trim().split(" ");
    let time = parts[0];
    let period = parts[1].toLowerCase();

    let t = time.split(":");
    let h = parseInt(t[0]);
    let m = parseInt(t[1]);
    let s = parseInt(t[2]);

    if (period === "pm" && h !== 12) {
        h += 12;
    }

    if (period === "am" && h === 12) {
        h = 0;
    }

    return h * 3600 + m * 60 + s;
}

function secondsToTime(seconds) {
    let h = Math.floor(seconds / 3600);
    seconds %= 3600;

    let m = Math.floor(seconds / 60);
    let s = seconds % 60;

    let mm = m < 10 ? "0" + m : "" + m;
    let ss = s < 10 ? "0" + s : "" + s;

    return h + ":" + mm + ":" + ss;
}

function durationToSeconds(duration) {
    let parts = duration.trim().split(":");

    let h = parseInt(parts[0]);
    let m = parseInt(parts[1]);
    let s = parseInt(parts[2]);

    return h * 3600 + m * 60 + s;
}

function detectSeparator(data) {
    if (data.includes("|")) return "|";
    return ",";
}

function getDayName(dateStr) {
    let d = new Date(dateStr);
    let days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return days[d.getDay()];
}

// ============================================================
// Function 1: getShiftDuration(startTime, endTime)
// ============================================================
function getShiftDuration(startTime, endTime) {
    let startSec = timeToSeconds(startTime);
    let endSec = timeToSeconds(endTime);

    let diff = endSec - startSec;

    return secondsToTime(diff);
}

// ============================================================
// Function 2: getIdleTime(startTime, endTime)
// ============================================================
function getIdleTime(startTime, endTime) {
    let start = timeToSeconds(startTime);
    let end = timeToSeconds(endTime);

    let eightAM = timeToSeconds("8:00:00 am");
    let tenPM = timeToSeconds("10:00:00 pm");

    let idle = 0;

    if (start < eightAM) {
        idle += eightAM - start;
    }

    if (end > tenPM) {
        idle += end - tenPM;
    }

    return secondsToTime(idle);
}

// ============================================================
// Function 3: getActiveTime(shiftDuration, idleTime)
// ============================================================
function getActiveTime(shiftDuration, idleTime) {
    let shiftSec = durationToSeconds(shiftDuration);
    let idleSec = durationToSeconds(idleTime);

    let active = shiftSec - idleSec;

    return secondsToTime(active);
}

// ============================================================
// Function 4: metQuota(date, activeTime)
// ============================================================
function metQuota(date, activeTime) {
    let activeSeconds = durationToSeconds(activeTime);
    let required;

    if (date >= "2025-04-10" && date <= "2025-04-30") {
        required = durationToSeconds("6:00:00");
    } else {
        required = durationToSeconds("8:24:00");
    }

    return activeSeconds >= required;
}

// ============================================================
// Function 5: addShiftRecord
// ============================================================
function addShiftRecord(textFile, shiftObj) {
    let raw = fs.readFileSync(textFile, "utf8");
    let sep = detectSeparator(raw);

    let trimmed = raw.trim();
    let lines = trimmed === "" ? [] : trimmed.split("\n");

    for (let line of lines) {
        let parts = line.split(sep).map(x => x.trim());

        if (parts[0] === shiftObj.driverID && parts[2] === shiftObj.date) {
            return {};
        }
    }

    let shiftDuration = getShiftDuration(shiftObj.startTime, shiftObj.endTime);
    let idleTime = getIdleTime(shiftObj.startTime, shiftObj.endTime);
    let activeTime = getActiveTime(shiftDuration, idleTime);
    let quota = metQuota(shiftObj.date, activeTime);
    let bonus = false;

    let record = {
        driverID: shiftObj.driverID,
        driverName: shiftObj.driverName,
        date: shiftObj.date,
        startTime: shiftObj.startTime,
        endTime: shiftObj.endTime,
        shiftDuration: shiftDuration,
        idleTime: idleTime,
        activeTime: activeTime,
        metQuota: quota,
        hasBonus: bonus
    };

    let newLine = [
        record.driverID,
        record.driverName,
        record.date,
        record.startTime,
        record.endTime,
        record.shiftDuration,
        record.idleTime,
        record.activeTime,
        record.metQuota,
        record.hasBonus
    ].join(sep);

    if (lines.length === 0) {
        fs.writeFileSync(textFile, newLine);
        return record;
    }

    let lastIndex = -1;
    for (let i = 0; i < lines.length; i++) {
        let parts = lines[i].split(sep).map(x => x.trim());
        if (parts[0] === shiftObj.driverID) {
            lastIndex = i;
        }
    }

    if (lastIndex === -1) {
        lines.push(newLine);
    } else {
        lines.splice(lastIndex + 1, 0, newLine);
    }

    fs.writeFileSync(textFile, lines.join("\n"));
    return record;
}

// ============================================================
// Function 6: setBonus
// ============================================================
function setBonus(textFile, driverID, date, newValue) {
    let raw = fs.readFileSync(textFile, "utf8");
    let sep = detectSeparator(raw);

    let trimmed = raw.trim();
    if (trimmed === "") {
        fs.writeFileSync(textFile, "");
        return;
    }

    let lines = trimmed.split("\n");

    for (let i = 0; i < lines.length; i++) {
        let parts = lines[i].split(sep).map(x => x.trim());

        if (parts[0] === driverID && parts[2] === date) {
            parts[9] = String(newValue);
            lines[i] = parts.join(sep);
            break;
        }
    }

    fs.writeFileSync(textFile, lines.join("\n"));
}

// ============================================================
// Function 7: countBonusPerMonth
// ============================================================
function countBonusPerMonth(textFile, driverID, month) {
    let raw = fs.readFileSync(textFile, "utf8");
    let sep = detectSeparator(raw);

    let trimmed = raw.trim();
    if (trimmed === "") return -1;

    let lines = trimmed.split("\n");

    let found = false;
    let count = 0;
    let targetMonth = parseInt(month);

    for (let line of lines) {
        let parts = line.split(sep).map(x => x.trim());

        if (parts[0] === driverID) {
            found = true;

            let m = parseInt(parts[2].split("-")[1]);
            let hasBonus = parts[9].toLowerCase() === "true";

            if (m === targetMonth && hasBonus) {
                count++;
            }
        }
    }

    if (!found) return -1;

    return count;
}

// ============================================================
// Function 8: getTotalActiveHoursPerMonth
// ============================================================
function getTotalActiveHoursPerMonth(textFile, driverID, month) {
    let raw = fs.readFileSync(textFile, "utf8");
    let sep = detectSeparator(raw);

    let trimmed = raw.trim();
    if (trimmed === "") return "0:00:00";

    let lines = trimmed.split("\n");
    let total = 0;
    let targetMonth = parseInt(month);

    for (let line of lines) {
        let parts = line.split(sep).map(x => x.trim());

        if (parts[0] === driverID) {
            let m = parseInt(parts[2].split("-")[1]);

            if (m === targetMonth) {
                total += durationToSeconds(parts[7]);
            }
        }
    }

    return secondsToTime(total);
}

// ============================================================
// Function 9: getRequiredHoursPerMonth
// ============================================================
function getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month) {
    let rateRaw = fs.readFileSync(rateFile, "utf8");
    let rateSep = detectSeparator(rateRaw);
    let rateTrimmed = rateRaw.trim();

    let dayOff = null;

    if (rateTrimmed !== "") {
        let rateLines = rateTrimmed.split("\n");

        for (let line of rateLines) {
            let parts = line.split(rateSep).map(x => x.trim());

            if (parts[0] === driverID) {
                dayOff = parts[1];
                break;
            }
        }
    }

    let raw = fs.readFileSync(textFile, "utf8");
    let sep = detectSeparator(raw);
    let trimmed = raw.trim();

    if (trimmed === "") {
        return "0:00:00";
    }

    let lines = trimmed.split("\n");
    let totalRequired = 0;
    let targetMonth = parseInt(month);

    for (let line of lines) {
        let parts = line.split(sep).map(x => x.trim());

        if (parts[0] === driverID) {
            let date = parts[2];
            let m = parseInt(date.split("-")[1]);

            if (m === targetMonth) {
                let dayName = getDayName(date);

                if (dayName !== dayOff) {
                    if (date >= "2025-04-10" && date <= "2025-04-30") {
                        totalRequired += durationToSeconds("6:00:00");
                    } else {
                        totalRequired += durationToSeconds("8:24:00");
                    }
                }
            }
        }
    }

    totalRequired -= bonusCount * durationToSeconds("2:00:00");

    if (totalRequired < 0) {
        totalRequired = 0;
    }

    return secondsToTime(totalRequired);
}

// ============================================================
// Function 10: getNetPay
// ============================================================
function getNetPay(driverID, actualHours, requiredHours, rateFile) {
    let raw = fs.readFileSync(rateFile, "utf8");
    let sep = detectSeparator(raw);

    let lines = raw.trim().split("\n");

    let basePay = 0;
    let tier = 0;

    for (let line of lines) {
        let parts = line.split(sep).map(x => x.trim());

        if (parts[0] === driverID) {
            basePay = parseInt(parts[2]);
            tier = parseInt(parts[3]);
            break;
        }
    }

    let allowanceHours = 0;

    if (tier === 1) allowanceHours = 50;
    else if (tier === 2) allowanceHours = 20;
    else if (tier === 3) allowanceHours = 10;
    else if (tier === 4) allowanceHours = 3;

    let actualSec = durationToSeconds(actualHours);
    let requiredSec = durationToSeconds(requiredHours);

    if (actualSec >= requiredSec) {
        return basePay;
    }

    let missingSec = requiredSec - actualSec;

    let remainingSecAfterAllowance = missingSec - (allowanceHours * 3600);

    if (remainingSecAfterAllowance <= 0) {
        return basePay;
    }

    let deductibleHours = Math.floor(remainingSecAfterAllowance / 3600);

    if (deductibleHours <= 0) {
        return basePay;
    }

    let deductionRatePerHour = Math.floor(basePay / 185);
    let deduction = deductibleHours * deductionRatePerHour;

    return basePay - deduction;
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
