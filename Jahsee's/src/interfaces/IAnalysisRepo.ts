import { Analysis, NewAnalysis } from '../models/Analysis'

export interface IAnalysisRepo {
    GetAnalysis(id: string): Promise< Analysis| null>;
    GetAllAnalysis(): Promise<Analysis[]>;
    GetAllIDs(): Promise<string[]>
    RemoveAnalysis(id: string): Promise<void>;
    AddAnalysis(analysis: NewAnalysis): Promise<Analysis>;
}