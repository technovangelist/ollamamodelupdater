import { encodeHex } from "https://deno.land/std@0.202.0/encoding/hex.ts";
import ollama from 'npm:ollama';

const local_models_raw = await ollama.list();
const localModels = local_models_raw.models.map((model) => ({ "name": model.name, "digest": model.digest }))

for await (const model of localModels) {
  const localdigest = model.digest
  let [repo, tag] = model.name.split(":")
  if (!repo.includes("/")) {
    repo = `library/${repo}`
  }
  
  const remoteModelInfo = await fetch(`https://ollama.ai/v2/${repo}/manifests/${tag}`, {
    headers: {
      "Accept": "application/vnd.docker.distribution.manifest.v2+json"
    }
  })

  if (remoteModelInfo.status == 200) {
    const remoteModelInfoJSON = await remoteModelInfo.json()

    const hash = await jsonhash(remoteModelInfoJSON);
    if (hash === localdigest) {
      console.log(`You have the latest ${model.name}`)
    } else {
      console.log(`You have an outdated version of ${model.name}`)
      console.log(`Updating ${model.name}`)
      const pullResponse = await ollama.pull({ model: model.name, stream: true }); 
      const enc = (s: string) => new TextEncoder().encode(s);
      let linelength = 0;
      for await (const part of pullResponse) {
        if (part.digest) {
          let percent = 0;
          if (part.completed && part.total) {
            percent = Math.round((part.completed / part.total) * 100);
          }
          const clear = ` `.repeat(linelength);
          Deno.stdout.write(enc(`\r${clear}\r${part.status} ${percent}%...`));
          linelength = `${part.status} ${percent}%...`.length;
          
        } else {
          
          Deno.stdout.write(enc(`\r${' '.repeat(linelength)}\r${part.status}\n`));
        }
      }
    }
  }
}

async function jsonhash(json: string) {
  const jsonstring = JSON.stringify(json).replace(/\s+/g, '')
  const messageBuffer = new TextEncoder().encode(jsonstring);
  const hashBuffer = await crypto.subtle.digest("SHA-256", messageBuffer);
  const hash = encodeHex(hashBuffer);

  return hash
}