import type { ChildProcess } from 'node:child_process'

export type ServerProcess = { process: ChildProcess; url: string }
