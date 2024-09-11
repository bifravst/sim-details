export const byTsDesc = (a: { ts: Date }, b: { ts: Date }): number =>
	b.ts.getTime() - a.ts.getTime()
