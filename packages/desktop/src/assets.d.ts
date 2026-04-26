// Global asset type declarations for RAILWISE Desktop
// This file provides TypeScript module declarations for various asset types

// Font files
declare module "*.woff" {
  const src: string
  export default src
}

declare module "*.woff2" {
  const src: string
  export default src
}

declare module "*.ttf" {
  const src: string
  export default src
}

declare module "*.otf" {
  const src: string
  export default src
}

declare module "*.eot" {
  const src: string
  export default src
}

// Audio files
declare module "*.aac" {
  const src: string
  export default src
}

declare module "*.mp3" {
  const src: string
  export default src
}

declare module "*.wav" {
  const src: string
  export default src
}

declare module "*.ogg" {
  const src: string
  export default src
}

declare module "*.m4a" {
  const src: string
  export default src
}

// Image files
declare module "*.svg" {
  const src: string
  export default src
}

declare module "*.png" {
  const src: string
  export default src
}

declare module "*.jpg" {
  const src: string
  export default src
}

declare module "*.jpeg" {
  const src: string
  export default src
}

declare module "*.gif" {
  const src: string
  export default src
}

declare module "*.webp" {
  const src: string
  export default src
}

declare module "*.ico" {
  const src: string
  export default src
}

declare module "*.bmp" {
  const src: string
  export default src
}

// Video files
declare module "*.mp4" {
  const src: string
  export default src
}

declare module "*.webm" {
  const src: string
  export default src
}

declare module "*.mov" {
  const src: string
  export default src
}

// Web worker files with special URL imports
declare module "*?worker&url" {
  const src: string
  export default src
}

declare module "*?worker" {
  const WorkerConstructor: new () => Worker
  export default WorkerConstructor
}

// Vite specific asset imports
declare module "*?url" {
  const src: string
  export default src
}

declare module "*?inline" {
  const src: string
  export default src
}

declare module "*?raw" {
  const src: string
  export default src
}
