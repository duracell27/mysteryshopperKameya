import mongoose, { Schema, Document } from 'mongoose';

export interface IAccessRule {
  division: string;
  position: string;
  modules: {
    mysteryShop: boolean;
    onboarding:  boolean;
    learning:    boolean;
  };
}

export interface IAccessMatrix extends Document {
  rules: IAccessRule[];
}

const AccessRuleSchema = new Schema<IAccessRule>({
  division: { type: String, required: true },
  position: { type: String, required: true },
  modules: {
    mysteryShop: { type: Boolean, default: false },
    onboarding:  { type: Boolean, default: false },
    learning:    { type: Boolean, default: true  },
  },
}, { _id: false });

const AccessMatrixSchema = new Schema<IAccessMatrix>({
  rules: [AccessRuleSchema],
});

export const AccessMatrix = mongoose.model<IAccessMatrix>('AccessMatrix', AccessMatrixSchema);

export const DEFAULT_RULES: IAccessRule[] = [
  { division: 'stores',   position: 'Початківець консультант', modules: { mysteryShop: false, onboarding: true,  learning: true } },
  { division: 'stores',   position: 'Консультант',             modules: { mysteryShop: true,  onboarding: false, learning: true } },
  { division: 'stores',   position: 'Керівник',                modules: { mysteryShop: true,  onboarding: false, learning: true } },
  { division: 'office',   position: 'Співробітник',            modules: { mysteryShop: false, onboarding: false, learning: true } },
  { division: 'office',   position: 'Керівник',                modules: { mysteryShop: false, onboarding: false, learning: true } },
  { division: 'security', position: 'Охоронець',               modules: { mysteryShop: false, onboarding: false, learning: true } },
  { division: 'security', position: 'Керівник',                modules: { mysteryShop: false, onboarding: false, learning: true } },
];
