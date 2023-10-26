import { Ollama } from 'npm:ollama-node@0.1.13';
import { encodeHex } from "https://deno.land/std@0.202.0/encoding/hex.ts";
const ollama = new Ollama();

const local_models_raw = await ollama.listModels()
const localModels = local_models_raw.complete.map((model) => ({ "name": model.name, "digest": model.digest }))

for await (const model of localModels) {
  const localdigest = model.digest
  // const model = localModels[0]
  // console.log(model)
  let [repo, tag] = model.name.split(":")
  if (!repo.includes("/")) {
    repo = `library/${repo}`
  }
  // console.log(repo);
  const remoteModelInfo = await fetch(`https://ollama.ai/v2/${repo}/manifests/${tag}`, {
    headers: {
      "Accept": "application/vnd.docker.distribution.manifest.v2+json"
    }
  })
  if (remoteModelInfo.status == 200) {
    const remoteModelInfoJSON = await remoteModelInfo.json()
    const jsonstring = JSON.stringify(remoteModelInfoJSON).replace(/\s+/g, '')
    const messageBuffer = new TextEncoder().encode(jsonstring);
    const hashBuffer = await crypto.subtle.digest("SHA-256", messageBuffer);
    const hash = encodeHex(hashBuffer);
    if (hash === localdigest) {
      console.log(`You have the latest ${model.name}`)
    } else {
      console.log(`You have an outdated version of ${model.name}`)
      console.log(`Updating ${model.name}`)
      await ollama.streamingPull(model.name, (chunk: string) => {
        try {
          const enc = (s: string) => new TextEncoder().encode(s);
          if (chunk.includes("success")) {
            Deno.stdout.write(enc(`\r\x1B[K${chunk}\n`))
          } else {
            Deno.stdout.write(enc(`\r\x1B[K${chunk}`))
          }
        } catch (error) {
          console.log(error)
        }

      })

    }
  }

}

//https://ollama.ai/v2/$REPO/manifests/$TAG -H "Accept:application/vnd.docker.distribution.manifest.v2+json"