import { describe, it, expect } from "vitest";
import { parseBloodPressure, parseVital, parseMedication, parseExercise } from "./parse";
import { triage } from "./triage";

describe("blood pressure parsing", () => {
  it("reads the structured line from the fallback format", () => {
    expect(parseBloodPressure("done 2/3, pain 6, BP 140/90")).toEqual({ systolic: 140, diastolic: 90 });
  });
  it("does not mistake an adherence ratio for a blood pressure", () => {
    expect(parseBloodPressure("did 2/3 sets")).toBeNull();
  });
  it("handles spacing and the word over", () => {
    expect(parseBloodPressure("BP was 138 over 84")).toEqual({ systolic: 138, diastolic: 84 });
  });
  it("rejects an implausible pair", () => {
    expect(parseBloodPressure("90/140")).toBeNull();
  });
});

describe("unit comes from the item, never from a guess", () => {
  it("uses the item unit when the patient states none", () => {
    const { reading, unitConflict } = parseVital("temp 38.2", "temperature", "C");
    expect(reading.unit).toBe("C");
    expect(reading.value).toBe(38.2);
    expect(unitConflict).toBe(false);
  });

  it("treats a stated unit that contradicts the item as unresolved, not a conversion", () => {
    const { reading, unitConflict } = parseVital("temp 101 F", "temperature", "C");
    expect(unitConflict).toBe(true);
    expect(reading.unit).toBeNull();
    // And unresolved must not pass as normal.
    expect(triage({ rawText: "temp 101 F", itemType: "vital", vital: reading }).level).toBe("AMBER");
  });

  it("accepts a stated unit that agrees with the item", () => {
    const { reading, unitConflict } = parseVital("38.2 C this morning", "temperature", "C");
    expect(unitConflict).toBe(false);
    expect(reading.unit).toBe("C");
  });

  it("reads glucose in the item unit", () => {
    const { reading } = parseVital("sugar was 5.6 mmol/L", "glucose", "mmol/L");
    expect(reading.value).toBe(5.6);
    expect(reading.unit).toBe("mmol/L");
  });
});

describe("medication parsing", () => {
  it("reads a clean taken report", () => {
    const r = parseMedication("took both this morning", false);
    expect(r.taken).toBe(true);
    expect(r.newSymptom).toBe(false);
  });
  it("reads a missed dose", () => {
    expect(parseMedication("forgot the evening one", false).taken).toBe(false);
  });
  it("resolves contradictory text to unknown rather than picking one", () => {
    expect(parseMedication("took the morning one but missed the evening", false).taken).toBeNull();
  });
  it("notices a new symptom", () => {
    expect(parseMedication("took it, felt dizzy after", false).newSymptom).toBe(true);
  });
});

describe("exercise parsing", () => {
  it("reads the structured line", () => {
    const r = parseExercise("done 2/3, pain 6");
    expect(r.completed).toBe(false);
    expect(r.pain).toBe(6);
  });
  it("counts a full ratio as completed", () => {
    expect(parseExercise("did 3/3 sets, pain 2").completed).toBe(true);
  });
  it("notices pain persisting the next day", () => {
    expect(parseExercise("did them all but still sore the next day").painPersistingOver24h).toBe(true);
  });
});

describe("end to end on the demo replies", () => {
  it("passes an ordinary reading", () => {
    const { reading } = parseVital("BP 124/78 this morning", "bp", "mmHg");
    expect(triage({ rawText: "BP 124/78 this morning", itemType: "vital", vital: reading }).level).toBe("GREEN");
  });

  it("escalates the reading that trips the threshold in front of the judge", () => {
    const text = "BP 186/104 today, bit of a headache";
    const { reading } = parseVital(text, "bp", "mmHg");
    const r = triage({ rawText: text, itemType: "vital", vital: reading });
    expect(r.level).toBe("RED");
  });

  it("escalates a red-flag reply whose numbers look fine", () => {
    const text = "BP 120/80 but I have chest pain when I walk upstairs";
    const { reading } = parseVital(text, "bp", "mmHg");
    const r = triage({ rawText: text, itemType: "vital", vital: reading });
    expect(r.level).toBe("RED");
    expect(r.keywordHits).toContain("chest pain");
  });
});
