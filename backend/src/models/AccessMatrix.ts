import mongoose, { Schema, Document } from 'mongoose';

export interface IAccessRule {
  division: string;
  position: string;
  modules: {
    mysteryShop: boolean;
    onboarding:  boolean;
    learning:    boolean;
    shop:        boolean;
    library:     boolean;
  };
}

export interface ILearningRule {
  division: string;
  group?:    string;
  position?: string;
  sections: {
    general:    boolean;
    start:      boolean;
    consultant: boolean;
    managers:   boolean;
    marketing:  boolean;
  };
}

export interface IAccessMatrix extends Document {
  rules:         IAccessRule[];
  learningRules: ILearningRule[];
}

const AccessRuleSchema = new Schema<IAccessRule>({
  division: { type: String, required: true },
  position: { type: String, required: true },
  modules: {
    mysteryShop: { type: Boolean, default: false },
    onboarding:  { type: Boolean, default: false },
    learning:    { type: Boolean, default: true  },
    shop:        { type: Boolean, default: false },
    library:     { type: Boolean, default: false },
  },
}, { _id: false });

const LearningRuleSchema = new Schema<ILearningRule>({
  division: { type: String, required: true },
  group:    { type: String },
  position: { type: String },
  sections: {
    general:    { type: Boolean, default: false },
    start:      { type: Boolean, default: false },
    consultant: { type: Boolean, default: false },
    managers:   { type: Boolean, default: false },
    marketing:  { type: Boolean, default: false },
  },
}, { _id: false });

const AccessMatrixSchema = new Schema<IAccessMatrix>({
  rules:         [AccessRuleSchema],
  learningRules: [LearningRuleSchema],
});

export const AccessMatrix = mongoose.model<IAccessMatrix>('AccessMatrix', AccessMatrixSchema);

export const DEFAULT_RULES: IAccessRule[] = [
  { division: 'stores',   position: 'Початківець консультант', modules: { mysteryShop: false, onboarding: true,  learning: true, shop: false, library: false } },
  { division: 'stores',   position: 'Консультант',             modules: { mysteryShop: true,  onboarding: false, learning: true, shop: false, library: false } },
  { division: 'stores',   position: 'Керівник',                modules: { mysteryShop: true,  onboarding: false, learning: true, shop: false, library: false } },
  { division: 'office',   position: 'Співробітник',            modules: { mysteryShop: false, onboarding: false, learning: true, shop: false, library: false } },
  { division: 'office',   position: 'Керівник',                modules: { mysteryShop: false, onboarding: false, learning: true, shop: false, library: false } },
  { division: 'security', position: 'Охоронець',               modules: { mysteryShop: false, onboarding: false, learning: true, shop: false, library: false } },
  { division: 'security', position: 'Керівник',                modules: { mysteryShop: false, onboarding: false, learning: true, shop: false, library: false } },
];

// group: 'other' means all office groups except 'marketing'
export const DEFAULT_LEARNING_RULES: ILearningRule[] = [
  { division: 'stores',   position: 'Початківець консультант', sections: { general: false, start: true,  consultant: false, managers: false, marketing: false } },
  { division: 'stores',   position: 'Консультант',             sections: { general: true,  start: false, consultant: true,  managers: false, marketing: false } },
  { division: 'stores',   position: 'Керівник',                sections: { general: true,  start: false, consultant: true,  managers: true,  marketing: false } },
  { division: 'office',   group:    'marketing',               sections: { general: true,  start: false, consultant: false, managers: false, marketing: true  } },
  { division: 'office',   group:    'other',                   sections: { general: true,  start: false, consultant: false, managers: false, marketing: false } },
  { division: 'security',                                       sections: { general: true,  start: false, consultant: false, managers: false, marketing: false } },
];
