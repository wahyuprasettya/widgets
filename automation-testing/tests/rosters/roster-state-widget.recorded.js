const { test, expect } = require("@playwright/test");
const fs = require("fs");
import dotenv from "dotenv";

dotenv.config();
const sandboxUrl = process.env.baseUrls;

async function openRosterPage(page) {
  await page.goto(sandboxUrl);

  const schoolSelect = page.getByLabel("Select school");
  await expect(schoolSelect).toBeVisible({ timeout: 20000 });
  await expect(schoolSelect).toHaveValue("");

  return schoolSelect;
}

async function prepareRoster(page) {
  const schoolSelect = await openRosterPage(page);

  // Wait for school options to be populated
  await schoolSelect
    .locator('option[value="7799930"]')
    .waitFor({ state: "attached", timeout: 10000 });

  await schoolSelect.selectOption("7799930");
  await schoolSelect.selectOption("10637966");
  await schoolSelect.selectOption("10641970");

  await expect(
    page.getByRole("button", { name: "Sort by jersey" }),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    page.getByRole("button", { name: "Sort by lastName" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sort by firstName" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sort by class" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sort by position" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sort by name" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Print Roster" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Download Roster as CSV" }),
  ).toBeVisible();

  return schoolSelect;
}

async function waitForPageReady(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle");
}

async function sortByColumn(page, columnName) {
  const sortButton = page.getByRole("button", {
    name: new RegExp(`Sort by ${columnName}`, "i"),
  });

  await expect(sortButton).toBeVisible();

  await sortButton.click();
  await page.waitForLoadState("networkidle");

  await sortButton.click();
  await page.waitForLoadState("networkidle");
}

async function openClassFilter(page) {
  const filterButton = page.getByRole("button", { name: /filter by class/i });

  await expect(filterButton).toBeVisible();
  await filterButton.locator("svg").click();

  await expect(filterButton).toHaveAttribute("aria-expanded", "true");

  const freshmanCheckbox = page.getByLabel("Freshman");
  await expect(freshmanCheckbox).toBeVisible();

  return page;
}

async function openPositionFilter(page) {
  await page
    .getByRole("columnheader", { name: "Title Filter" })
    .getByLabel("Filter by position")
    .click();
  await expect(page.getByLabel("Title Filter")).toBeVisible();
}

async function verifyRosterAccessibility(page) {
  const schoolSelect = page.getByLabel("Select school");
  await expect(schoolSelect).toHaveAccessibleName("Select school");

  const rosterControls = [
    "Sort by jersey",
    "Sort by lastName",
    "Sort by firstName",
    "Sort by class",
    "Sort by position",
    "Sort by name",
    "Print Roster",
    "Download Roster as CSV",
  ];

  for (const controlName of rosterControls) {
    const control = page.getByRole("button", { name: controlName });
    await expect(control).toHaveAccessibleName(controlName);
  }

  const classMenu = await openClassFilter(page);
  await classMenu.getByRole("checkbox", { name: "Freshman" }).check();

  const titleFilterButton = page
    .getByRole("columnheader", { name: "Title Filter" })
    .getByLabel("Filter by position");
  await expect(titleFilterButton).toBeVisible();
  await expect(titleFilterButton).toHaveAccessibleName("Filter by position");
}

async function verifyRosterAriaState(page) {
  // Check aria-expanded for Class Filter
  const classFilterButton = page.getByRole("button", {
    name: /filter by class/i,
  });
  await classFilterButton.locator("svg").click();
  await expect(classFilterButton).toHaveAttribute("aria-expanded", "true");

  await classFilterButton.click();
  await expect(classFilterButton).toHaveAttribute("aria-expanded", "false");

  // Check checkboxes inside the filter

  const classMenu = await openClassFilter(page);
  const freshmanCheckbox = page.getByLabel("Freshman");
  await classMenu.getByRole("checkbox", { name: "Freshman" }).check();

  await classMenu.getByRole("checkbox", { name: "Freshman" }).uncheck();
  await expect(freshmanCheckbox).not.toBeChecked();

  //  Close filter and check state again
  await classFilterButton.click();
  await expect(classFilterButton).toHaveAttribute("aria-expanded", "false");

  // Check Sort buttons for aria-sort

  // const jerseySortBtn = page.getByRole("button", { name: "Sort by jersey" });
  // const jerseyHeader = page.getByRole("columnheader", { name: /jersey/i });
  // await jerseySortBtn.click();

  // We check for aria-sort on the header cell or the button itself if it's used there
  // const sortState = await jerseyHeader.getAttribute("aria-sort") || await jerseySortBtn.getAttribute("aria-sort");
  // expect(sortState).toMatch(/ascending|descending/);
  // console.log("sortState:", sortState);

  // await jerseySortBtn.click();
  // const sortState2 = await jerseyHeader.getAttribute("aria-sort") || await jerseySortBtn.getAttribute("aria-sort");
  // expect(sortState2).toMatch(/ascending|descending/);

  // Check Position Filter
  const titleFilterButton = page
    .getByRole("columnheader", { name: "Title Filter" })
    .getByLabel("Filter by position");
  await expect(titleFilterButton).toHaveAccessibleName("Filter by position");

  await titleFilterButton.click();
  await expect(page.getByLabel("Title Filter")).toBeVisible();
}

test.describe("Roster widget recorded flow", () => {
  test("scenario: selecting schools reveals roster controls", async ({
    page,
  }) => {
    await prepareRoster(page);

    await page.getByText("Coaches").scrollIntoViewIfNeeded();
    await expect(page.getByText("Coaches")).toBeVisible();
  });

  test("scenario: printing and downloading the roster works", async ({
    page,
  }) => {
    await prepareRoster(page);
    await waitForPageReady(page);
    await sortByColumn(page, "Class");

    await page.getByRole("button", { name: "Print Roster" }).click();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download Roster as CSV" }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^Roster_.*\.csv$/);

    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();

    const csvText = fs.readFileSync(downloadPath, "utf8");
    expect(csvText).toContain("Players");
    expect(csvText).toContain("Coaches");
    expect(csvText).toContain("Jersey");
    expect(csvText).toContain("Last Name");
    expect(csvText).toContain("First Name");
  });

  test("scenario: sorting by player columns stays usable", async ({ page }) => {
    await prepareRoster(page);

    await page.getByRole("button", { name: "Sort by jersey" }).click();
    await page.getByRole("button", { name: "Sort by jersey" }).click();
    await page.getByRole("button", { name: "Sort by lastName" }).click();
    await page.getByRole("button", { name: "Sort by lastName" }).click();
    await page.getByRole("button", { name: "Sort by firstName" }).click();
    await page.getByRole("button", { name: "Sort by firstName" }).click();
  });

  test("scenario: filtering by class stays usable", async ({ page }) => {
    await prepareRoster(page);
    await waitForPageReady(page);
    await sortByColumn(page, "Class");

    await page.getByRole("button", { name: "Sort by class" }).click();
    await page.getByRole("button", { name: "Sort by class" }).click();

    const classMenu = await openClassFilter(page);

    await classMenu.getByRole("checkbox", { name: "Freshman" }).check();
    await classMenu.getByRole("checkbox", { name: "Junior" }).check();
    await classMenu.getByRole("checkbox", { name: "Freshman" }).uncheck();
    await classMenu.getByRole("checkbox", { name: "Junior" }).uncheck();
  });

  test("scenario: filtering coaches stays usable", async ({ page }) => {
    await prepareRoster(page);
    await waitForPageReady(page);
    await sortByColumn(page, "Class");

    await page.getByRole("button", { name: "Sort by position" }).click();
    await page.getByRole("button", { name: "Sort by position" }).click();
    await page.getByRole("button", { name: "Sort by name" }).click();
    await page.getByRole("button", { name: "Sort by name" }).click();

    await openPositionFilter(page);
    const titleFilter = page.getByLabel("Title Filter");

    await titleFilter.locator("#position-0").check();
    await titleFilter.locator("#position-0").uncheck();
  });

  test("scenario: core roster controls remain accessible", async ({ page }) => {
    await prepareRoster(page);
    await waitForPageReady(page);
    await sortByColumn(page, "Class");
    await verifyRosterAccessibility(page);
  });

  test("scenario: aria state is exposed for roster filters", async ({
    page,
  }) => {
    await prepareRoster(page);
    await waitForPageReady(page);
    await sortByColumn(page, "Class");
    await verifyRosterAriaState(page);
  });
});
