const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const scenarioDefinitions = [
  {
    title: "scenario: selecting schools reveals roster controls",
    focus: "Mouse",
    type: "Functional",
    preCondition: "Roster state widget page is opened.",
    scenario: "Selecting schools reveals roster controls",
    steps: [
      "Open the roster state widget page.",
      "Select the three schools used in the roster flow.",
      "Verify the roster controls become visible.",
    ],
    expectedResult: "Roster controls appear after the schools are selected.",
  },
  {
    title: "scenario: printing and downloading the roster works",
    focus: "Mouse",
    type: "Functional",
    preCondition: "Roster controls are visible after school selection.",
    scenario: "Printing and downloading the roster works",
    steps: [
      "Open the roster state widget page.",
      "Select the required schools.",
      "Sort by Class.",
      "Click Print Roster.",
      "Download the roster as CSV.",
    ],
    expectedResult: "Print action is available and the CSV download succeeds.",
  },
  {
    title: "scenario: sorting by player columns stays usable",
    focus: "Mouse",
    type: "Functional",
    preCondition: "Roster controls are visible after school selection.",
    scenario: "Sorting by player columns stays usable",
    steps: [
      "Open the roster state widget page.",
      "Select the required schools.",
      "Click jersey, lastName, and firstName sort buttons twice each.",
    ],
    expectedResult: "Sorting controls respond without errors and remain usable.",
  },
  {
    title: "scenario: filtering by class stays usable",
    focus: "Mouse",
    type: "Functional",
    preCondition: "Roster controls are visible after school selection.",
    scenario: "Filtering by class stays usable",
    steps: [
      "Open the roster state widget page.",
      "Select the required schools.",
      "Sort by Class.",
      "Open the class filter.",
      "Check and uncheck Freshman and Junior.",
    ],
    expectedResult: "Class filter opens and the checkbox options toggle correctly.",
  },
  {
    title: "scenario: filtering coaches stays usable",
    focus: "Mouse",
    type: "Functional",
    preCondition: "Roster controls are visible after school selection.",
    scenario: "Filtering coaches stays usable",
    steps: [
      "Open the roster state widget page.",
      "Select the required schools.",
      "Sort by Class.",
      "Open the position filter.",
      "Check and uncheck the coach position option.",
    ],
    expectedResult: "Coach filter opens and the option toggles correctly.",
  },
  {
    title: "scenario: core roster controls remain accessible",
    focus: "Mouse",
    type: "Accessibility",
    preCondition: "Roster controls are visible after school selection.",
    scenario: "Core roster controls remain accessible",
    steps: [
      "Open the roster state widget page.",
      "Select the required schools.",
      "Verify accessible names for the school selector and key buttons.",
      "Open the class filter and confirm its expanded state.",
    ],
    expectedResult: "Key controls expose the expected accessible names and ARIA state.",
  },
];

function currentDateInJakarta() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function summarizeError(error) {
  if (!error) return "";

  if (error.message) {
    return String(error.message).split("\n").map((line) => line.trim()).filter(Boolean)[0] || "";
  }

  if (error.stack) {
    return String(error.stack).split("\n").map((line) => line.trim()).filter(Boolean)[0] || "";
  }

  if (error.value) {
    return String(error.value);
  }

  return String(error).split("\n").map((line) => line.trim()).filter(Boolean)[0] || "";
}

function formatErrorDetail(error) {
  if (!error) return "";

  const parts = [];

  if (error.message) {
    parts.push(error.message.trim());
  }

  if (error.stack) {
    const stack = error.stack.trim();
    if (!parts.includes(stack)) {
      parts.push(stack);
    }
  }

  if (!parts.length && error.value) {
    parts.push(String(error.value));
  }

  return parts.join("\n");
}

function buildErrorDetail(result) {
  const errors = Array.isArray(result.errors) && result.errors.length
    ? result.errors
    : result.error
      ? [result.error]
      : [];

  if (!errors.length) return "";

  return errors
    .map((error, index) => {
      const heading = errors.length > 1 ? `Error ${index + 1}` : "Error detail";
      const detail = formatErrorDetail(error);
      return detail ? `${heading}\n${detail}` : heading;
    })
    .join("\n\n");
}

class RosterXlsxReporter {
  constructor() {
    this.resultsByTitle = new Map();
  }

  onTestEnd(test, result) {
    this.resultsByTitle.set(test.title, {
      status: result.status,
      file: test.location && test.location.file ? test.location.file : "",
      line: test.location && typeof test.location.line === "number" ? test.location.line : "",
      duration: typeof result.duration === "number" ? result.duration : "",
      retry: typeof result.retry === "number" ? result.retry : "",
      issue: summarizeError(result.error),
      errorDetail: buildErrorDetail(result),
    });
  }

  onEnd() {
    if (!this.resultsByTitle.size) return;

    const reportRows = [];

    for (let index = 0; index < scenarioDefinitions.length; index += 1) {
      const scenario = scenarioDefinitions[index];
      const result = this.resultsByTitle.get(scenario.title);

      if (!result) continue;

      reportRows.push({
        focus: scenario.focus,
        type: scenario.type,
        id: `RST-${String(index + 1).padStart(2, "0")}`,
        testFile: result.file,
        line: result.line,
        duration: result.duration,
        retry: result.retry,
        preCondition: scenario.preCondition,
        scenario: scenario.scenario,
        testSteps: scenario.steps.join("\n"),
        expectedResult: scenario.expectedResult,
        result: result.status === "passed" ? "Passed" : result.status === "skipped" ? "Skipped" : "Failed",
        notes: result.issue,
        errorDetail: result.errorDetail,
      });
    }

    const outputDir = path.resolve(process.cwd(), "test-results");
    fs.mkdirSync(outputDir, { recursive: true });

    const jsonPath = path.join(outputDir, "roster-test-report.json");
    const xlsxPath = path.resolve(process.cwd(), `test-automation-roster-state-${currentDateInJakarta()}.xlsx`);

    fs.writeFileSync(
      jsonPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          rows: reportRows,
        },
        null,
        2,
      ),
    );

    try {
      const generator = path.resolve(__dirname, "..", "scripts", "generate_roster_xlsx.py");
      execFileSync("python3", [generator, jsonPath, xlsxPath], { stdio: "inherit" });
      console.log(`\nExcel report generated: ${xlsxPath}`);
    } catch (error) {
      console.error("\nFailed to generate Excel report.");
      console.error(error && error.message ? error.message : error);
    }
  }
}

module.exports = RosterXlsxReporter;
