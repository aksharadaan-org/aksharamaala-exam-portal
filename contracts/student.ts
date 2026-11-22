export type Locale = 'en' | 'te';
export type Stage = 0 | 1 | 2 | 3 | 4;
export type Translation = Record<Locale, string>;
export type Score = { quality: string; earned: number; possible: number };
export type Item = Translation & {
  id: string; quality: string; options: Translation[]; choice: number | null;
};
export type ProgressEntry = {
  id: string; stage: Stage; submitted: string | null; scores: Score[];
};
export type Attempt = ProgressEntry & {student: string; created: string; items: Item[]};
export type Quality = Translation & {id:string; dimension:string; selected:0|1};
export type Profile = {id:string; name:string; school:string; locale:Locale; grade:string};
