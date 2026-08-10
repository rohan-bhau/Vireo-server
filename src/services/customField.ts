import CustomField, { CustomFieldType } from "../models/mongoose/CustomField";
import { AppError } from "../utils/AppError";

interface CustomFieldInput {
  name: string;
  type: CustomFieldType;
  options?: string[];
  required?: boolean;
}

function normalizeOptions(type: CustomFieldType, options: string[] | undefined): string[] {
  if (type !== "SELECT" && type !== "MULTISELECT") return [];
  const cleaned = (options || [])
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
  if (cleaned.length === 0) {
    throw new AppError(`Add at least one option for ${type === "SELECT" ? "Select" : "Multi-select"} fields`, 400);
  }
  return Array.from(new Set(cleaned));
}

async function assertUniqueName(workspaceId: string, name: string, excludeId?: string) {
  const existing = await CustomField.findOne({
    workspaceId,
    name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).lean();
  if (existing) {
    throw new AppError("A custom field with this name already exists", 400);
  }
}

export async function listCustomFields(workspaceId: string) {
  return CustomField.find({ workspaceId }).sort({ order: 1, createdAt: 1 }).lean();
}

export async function createCustomField(workspaceId: string, input: CustomFieldInput) {
  const name = input.name.trim();
  if (!name) throw new AppError("Field name is required", 400);
  await assertUniqueName(workspaceId, name);

  const count = await CustomField.countDocuments({ workspaceId });
  const field = await CustomField.create({
    workspaceId,
    name,
    type: input.type || "TEXT",
    options: normalizeOptions(input.type || "TEXT", input.options),
    required: !!input.required,
    order: count,
  });

  return field.toObject();
}

export async function updateCustomField(
  workspaceId: string,
  fieldId: string,
  patch: Partial<CustomFieldInput>
) {
  const field = await CustomField.findOne({ workspaceId, _id: fieldId });
  if (!field) throw new AppError("Custom field not found", 404);

  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) throw new AppError("Field name is required", 400);
    await assertUniqueName(workspaceId, name, fieldId);
    field.name = name;
  }
  if (patch.type !== undefined) {
    field.type = patch.type;
    field.options = normalizeOptions(patch.type, patch.options !== undefined ? patch.options : field.options);
  } else if (patch.options !== undefined) {
    field.options = normalizeOptions(field.type, patch.options);
  }
  if (patch.required !== undefined) field.required = !!patch.required;

  const updated = await field.save();
  return updated.toObject();
}

export async function deleteCustomField(workspaceId: string, fieldId: string) {
  const result = await CustomField.deleteOne({ workspaceId, _id: fieldId });
  if (result.deletedCount === 0) throw new AppError("Custom field not found", 404);
  return { success: true };
}

export async function sanitizeCustomFieldValues(
  workspaceId: string,
  values: Record<string, unknown>
): Promise<Record<string, string | number | null>> {
  const fields = await CustomField.find({ workspaceId }).lean();
  const byId = new Map(fields.map((f) => [String(f._id), f]));
  const cleaned: Record<string, string | number | null> = {};

  for (const [fieldId, rawValue] of Object.entries(values || {})) {
    const field = byId.get(fieldId);
    if (!field) continue;

    let value: string | number | null = rawValue as string | number | null;
    if (typeof value === "string") value = value.trim();

    if (field.type === "NUMBER") {
      if (value === "" || value === null || value === undefined) {
        value = null;
      } else {
        const num = Number(value);
        if (Number.isNaN(num)) throw new AppError(`"${field.name}" must be a number`, 400);
        value = num;
      }
    } else if (value === "" || value === null || value === undefined) {
      value = null;
    }

    if (field.required && (value === null || value === "")) {
      throw new AppError(`"${field.name}" is required`, 400);
    }

    if (field.type === "SELECT" || field.type === "MULTISELECT") {
      if (value === null) {
        cleaned[fieldId] = null;
        continue;
      }
      const selected = Array.isArray(rawValue) ? rawValue : String(rawValue).split(",");
      const allowed = new Set(field.options);
      const filtered = selected
        .map((s) => String(s).trim())
        .filter((s) => allowed.has(s));
      if (field.required && filtered.length === 0) {
        throw new AppError(`"${field.name}" is required`, 400);
      }
      cleaned[fieldId] = field.type === "MULTISELECT" ? selected.map(String).join(",") : (filtered[0] ?? null);
      continue;
    }

    cleaned[fieldId] = value;
  }

  return cleaned;
}