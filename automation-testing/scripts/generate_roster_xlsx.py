#!/usr/bin/env python3

import json
import sys
from pathlib import Path
from xml.sax.saxutils import escape
from zipfile import ZipFile, ZIP_DEFLATED


HEADERS = [
    "Focus",
    "Type",
    "ID",
    "Test File",
    "Line",
    "Duration (ms)",
    "Retry",
    "Pre-Condition",
    "Scenario",
    "Test Steps",
    "Expected Result",
    "Result",
    "Notes / Issue",
    "Error Detail",
]


def col_letter(index: int) -> str:
    result = ""
    while index:
        index, remainder = divmod(index - 1, 26)
        result = chr(65 + remainder) + result
    return result


def xml_text(value: str) -> str:
    return escape(str(value)).replace("\n", "&#10;")


def cell(ref: str, value: str, style: int) -> str:
    return f'<c r="{ref}" t="inlineStr" s="{style}"><is><t xml:space="preserve">{xml_text(value)}</t></is></c>'


def build_sheet_xml(rows):
    header_cells = "".join(cell(f"{col_letter(i)}1", header, 2) for i, header in enumerate(HEADERS, start=1))

    row_xml = []
    for row_index, row in enumerate(rows, start=2):
        values = [
            row.get("focus", ""),
            row.get("type", ""),
            row.get("id", ""),
            row.get("testFile", ""),
            row.get("line", ""),
            row.get("duration", ""),
            row.get("retry", ""),
            row.get("preCondition", ""),
            row.get("scenario", ""),
            row.get("testSteps", ""),
            row.get("expectedResult", ""),
            row.get("result", ""),
            row.get("notes", ""),
            row.get("errorDetail", ""),
        ]
        cells = "".join(cell(f"{col_letter(i)}{row_index}", value, 1) for i, value in enumerate(values, start=1))
        row_xml.append(f'<row r="{row_index}" ht="96" customHeight="1">{cells}</row>')

    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews>
    <sheetView workbookViewId="0">
      <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
      <selection pane="bottomLeft" activeCell="A2" sqref="A2"/>
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="20"/>
  <cols>
    <col min="1" max="1" width="14" customWidth="1"/>
    <col min="2" max="2" width="16" customWidth="1"/>
    <col min="3" max="3" width="12" customWidth="1"/>
    <col min="4" max="4" width="42" customWidth="1"/>
    <col min="5" max="5" width="10" customWidth="1"/>
    <col min="6" max="6" width="14" customWidth="1"/>
    <col min="7" max="7" width="10" customWidth="1"/>
    <col min="8" max="8" width="28" customWidth="1"/>
    <col min="9" max="9" width="34" customWidth="1"/>
    <col min="10" max="10" width="52" customWidth="1"/>
    <col min="11" max="11" width="40" customWidth="1"/>
    <col min="12" max="12" width="14" customWidth="1"/>
    <col min="13" max="13" width="22" customWidth="1"/>
    <col min="14" max="14" width="60" customWidth="1"/>
  </cols>
  <sheetData>
    <row r="1" ht="24" customHeight="1">{header_cells}</row>
    {''.join(row_xml)}
  </sheetData>
  <autoFilter ref="A1:N{len(rows) + 1}"/>
</worksheet>
"""


def build_styles_xml():
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font>
      <sz val="11"/>
      <color rgb="000000"/>
      <name val="Calibri"/>
      <family val="2"/>
    </font>
    <font>
      <b/>
      <sz val="11"/>
      <color rgb="000000"/>
      <name val="Calibri"/>
      <family val="2"/>
    </font>
  </fonts>
  <fills count="3">
    <fill>
      <patternFill patternType="none"/>
    </fill>
    <fill>
      <patternFill patternType="gray125"/>
    </fill>
    <fill>
      <patternFill patternType="solid">
        <fgColor rgb="A9D18E"/>
        <bgColor indexed="64"/>
      </patternFill>
    </fill>
  </fills>
  <borders count="2">
    <border>
      <left/>
      <right/>
      <top/>
      <bottom/>
      <diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="000000"/></left>
      <right style="thin"><color rgb="000000"/></right>
      <top style="thin"><color rgb="000000"/></top>
      <bottom style="thin"><color rgb="000000"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="3">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1">
      <alignment vertical="top" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment vertical="center" wrapText="1"/>
    </xf>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
  <dxfs count="0"/>
  <tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>
</styleSheet>
"""


def build_workbook_xml():
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Roster State" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>
"""


def build_workbook_rels_xml():
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>
"""


def build_root_rels_xml():
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>
"""


def build_content_types_xml():
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>
"""


def main():
    if len(sys.argv) != 3:
        print("Usage: generate_roster_xlsx.py <input-json> <output-xlsx>", file=sys.stderr)
        return 2

    input_json = Path(sys.argv[1])
    output_xlsx = Path(sys.argv[2])

    payload = json.loads(input_json.read_text(encoding="utf-8"))
    rows = payload.get("rows", [])

    output_xlsx.parent.mkdir(parents=True, exist_ok=True)

    with ZipFile(output_xlsx, "w", ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", build_content_types_xml())
        archive.writestr("_rels/.rels", build_root_rels_xml())
        archive.writestr("xl/workbook.xml", build_workbook_xml())
        archive.writestr("xl/_rels/workbook.xml.rels", build_workbook_rels_xml())
        archive.writestr("xl/styles.xml", build_styles_xml())
        archive.writestr("xl/worksheets/sheet1.xml", build_sheet_xml(rows))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
