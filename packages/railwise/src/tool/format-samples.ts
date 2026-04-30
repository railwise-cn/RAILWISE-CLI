export namespace FormatSamples {
  export const list = [
    {
      id: "cosa-in2",
      label: "COSA .in2 CPIII baseline",
      sourceFormat: "cosa-in2",
      expectedFormat: "cosa-in2",
      expectedWarnings: 0,
      unknowns: ["dN_CP301", "dE_CP301"],
      content: [
        "3.5,5,5",
        "CP300,4003.855,2903.360",
        "CP301,4094.969,3854.515",
        "CP300",
        "CP301,L,0",
        "CP301,S,339.366",
        "unknowns,dN_CP301,dE_CP301",
        "equation,baseline_north,dN_CP301=1,observed=0.002,weight=1",
        "equation,baseline_east,dE_CP301=1,observed=-0.001,weight=1",
        "equation,closure_vector,dN_CP301=1,dE_CP301=1,observed=0.0005,weight=0.8",
      ].join("\n"),
    },
    {
      id: "nasew-dat",
      label: "NASEW DAT baseline",
      sourceFormat: "auto",
      expectedFormat: "nasew-dat",
      expectedWarnings: 0,
      unknowns: ["dN_CP301"],
      content: [
        "NASEW DAT",
        "P CP300 4003.855 2903.360",
        "OBS CP300 CP301 DIST 339.366 1",
        "UNK dN_CP301",
        "EQ baseline_north dN_CP301=1 observed=0.002 weight=1",
      ].join("\n"),
    },
    {
      id: "south-in",
      label: "South .in baseline",
      sourceFormat: "auto",
      expectedFormat: "south-in",
      expectedWarnings: 0,
      unknowns: ["dN_CP301"],
      content: [
        "南方平差易",
        "ZD CP300 4003.855 2903.360",
        "GC CP300 CP301 S 339.366 1",
        "PARAMS dN_CP301",
        "EQU baseline_north dN_CP301=1 L=0.002 P=1",
      ].join("\n"),
    },
    {
      id: "lgo-asc",
      label: "Leica LGO ASCII baseline",
      sourceFormat: "auto",
      expectedFormat: "lgo-asc",
      expectedWarnings: 0,
      unknowns: ["dN_CP301"],
      content: [
        "LEICA LGO",
        "POINT CP300 4003.855 2903.360",
        "BASELINE CP300 CP301 GNSS 0.002 1",
        "UNKNOWN dN_CP301",
        "ADJ baseline_north dN_CP301=1 RHS=0.002 W=1",
      ].join("\n"),
    },
    {
      id: "tbc-csv",
      label: "Trimble TBC CSV baseline",
      sourceFormat: "auto",
      expectedFormat: "tbc-csv",
      expectedWarnings: 0,
      unknowns: ["dN_CP301"],
      content: [
        "Point ID,Northing,Easting",
        "CP300,4003.855,2903.360",
        "From Point,To Point,Type,Value,Weight",
        "CP300,CP301,DIST,339.366,1",
        "Name,dN_CP301,Observed,Weight",
        "baseline_north,1,0.002,1",
      ].join("\n"),
    },
    {
      id: "south-damaged",
      label: "South .in damaged but usable",
      sourceFormat: "auto",
      expectedFormat: "south-in",
      expectedWarnings: 2,
      damaged: true,
      unknowns: ["dN_CP301"],
      content: [
        "南方平差易",
        "点号,纵坐标,横坐标",
        "CP300,4003.855,2903.360",
        "测站,目标,类型,观测值,权",
        "CP300,CP301,S,339.366,1",
        "BROKEN,10,not-a-supported-row",
        "EQU damaged observed=1",
        "Name,dN_CP301,观测值,权",
        "baseline_north,1,0.002,1",
      ].join("\n"),
    },
  ] as const

  export function get(id: string) {
    const sample = list.find((item) => item.id === id)
    if (!sample) throw new Error(`Missing format sample: ${id}`)
    return sample
  }
}
