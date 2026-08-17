import "react"

declare module "*?worker&inline" {
  const WorkerFactory: { new (): Worker }
  export default WorkerFactory
}

/* `webkitdirectory` is how a file input is asked for a whole folder. */
declare module "react" {
  interface InputHTMLAttributes<T> {
    webkitdirectory?: string
    directory?: string
  }
}
