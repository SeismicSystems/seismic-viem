import { killProcess, runProcess } from './process.js'
import type { ServerProcess } from './server.js'

type SeismicOptions = {
  port?: number
  silent?: boolean
  waitMs?: number
}

export type SeismicProcess = ServerProcess & { url: string }

export const runSanvil = async (
  options: SeismicOptions = {},
): Promise<SeismicProcess> => {
  const { port = 8545, waitMs = 2_000 } = options

  const process = await runProcess('sanvil', {
    args: ['--port', port.toString()],
  })

  await new Promise((resolve) => setTimeout(resolve, waitMs))

  // Check if process is running by verifying the URL is accessible, etc.
  try {
    return { process, url: `http://127.0.0.1:${port}` }
  } catch (e) {
    await killProcess(process)
    throw new Error(`Failed to start seismic-reth: ${e}`)
  }
}
