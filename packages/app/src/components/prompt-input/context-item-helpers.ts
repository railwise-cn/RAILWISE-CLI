export const shouldOpenContextItemKey = (key: string) => key === "Enter" || key === " "

export const contextItemOpenLabel = (open: string, filename: string) => `${open} ${filename}`
