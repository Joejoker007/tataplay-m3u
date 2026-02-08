"use client"

import { useState } from "react"

export default function HomeDashboard({ playlistUrl }: { playlistUrl: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(playlistUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // fallback
      const input = document.createElement("input")
      input.value = playlistUrl
      document.body.appendChild(input)
      input.select()
      document.execCommand("copy")
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-2xl bg-card p-8 shadow-2xl">
        <h1 className="mb-8 text-center text-3xl font-semibold text-foreground">
          TATAPLAY Localhost M3U
        </h1>

        <div className="mb-8 flex gap-3">
          <input
            type="text"
            value={playlistUrl}
            readOnly
            className="flex-1 rounded-lg border border-border bg-secondary px-4 py-3 text-foreground"
          />
          <button
            onClick={handleCopy}
            className="rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          Coded with love by{" "}
          <a
            href="https://t.me/ygx_world"
            target="_blank"
            rel="noopener noreferrer"
            className="text-secondary-foreground transition-colors hover:text-foreground"
          >
            YGX WORLD
          </a>{" "}
          team
        </div>
      </div>
    </div>
  )
}
