export interface Team {
    id: string;
    name: string;
    shortName: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface Driver {
    id: string;
    name: string;
    number: number;
    team: string;
    createdAt: Date;
    updatedAt: Date;
}