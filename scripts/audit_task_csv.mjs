import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const sourcePath = "/home/ubuntu/upload/maunt_hospital_task_list.csv";
const source = await readFile(sourcePath, "utf8");
const lines = source
  .split(/\r?\n/)
  .map((line, index) => ({ line, lineNumber: index + 1 }))
  .filter(({ line }) => line.trim());

const header = lines.shift();
const expectedColumns = 5;
const rows = lines.map(({ line, lineNumber }) => {
  const columns = line.split(",");
  return { lineNumber, columns, raw: line };
});

const malformed = rows.filter(row => row.columns.length !== expectedColumns);
const normalized = rows
  .filter(row => row.columns.length === expectedColumns)
  .map(row => ({
    lineNumber: row.lineNumber,
    department: row.columns[0].trim(),
    task: row.columns[1].trim(),
    frequency: row.columns[2].trim(),
    pointWeight: row.columns[3].trim(),
    notes: row.columns[4].trim(),
  }));
const departments = [...new Set(normalized.map(row => row.department))].sort();
const frequencies = Object.fromEntries(
  [...new Set(normalized.map(row => row.frequency))]
    .sort()
    .map(frequency => [
      frequency,
      normalized.filter(row => row.frequency === frequency).length,
    ])
);
const invalidFrequency = normalized.filter(
  row => !["Daily", "Weekly", "Monthly"].includes(row.frequency)
);
const invalidWeight = normalized.filter(
  row => !/^[1-3]$/.test(row.pointWeight)
);

console.log(
  JSON.stringify(
    {
      header: header?.line,
      sourceRows: rows.length,
      validRows: normalized.length,
      malformedRows: malformed.map(row => ({
        lineNumber: row.lineNumber,
        columnCount: row.columns.length,
        raw: row.raw,
      })),
      departments,
      frequencies,
      invalidFrequency,
      invalidWeight,
    },
    null,
    2
  )
);
