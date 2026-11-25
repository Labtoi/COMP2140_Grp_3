import { Prep } from "../models/Prep"

// Which dish a prep step belongs to.
export type PrepOwner = { meal: string } | { side: string };

export interface IPreplistRepository {
    showAllPrep(): Promise<Prep[]>;
    getPrep(name: string): Promise<Prep>;
    addPrep(owner: PrepOwner, prep: Prep): Promise<Prep>;
    updatePrep(name: string, changes: Partial<Omit<Prep, "id">>): Promise<Prep>;
    removePrep(name: string): Promise<void>;
}