/* Kokoro neural-voice worker for DK Quiz — runs the voice model OFF the page's
   main thread, so video exports NEVER hang (the old main-thread Kokoro blocked the
   UI and hung mobiles — that is why it was removed on 2026-10-26).
   First init downloads ~30MB once (then browser-cached). Each {speak} returns a
   Float32Array of PCM samples; the page mixes it into the export timeline. */
import {KokoroTTS} from "https://cdn.jsdelivr.net/npm/kokoro-js/+esm";

let tts=null;

self.onmessage=async (e)=>{
  const m=e.data||{};
  if(m.type==="init"){
    try{
      if(!tts){
        /* Try the phone's graphics chip (WebGPU) first — can be several times faster than
           the normal processor for AI voice. Falls back to the normal path if unavailable. */
        let device=null;
        try{
          if(self.navigator&&self.navigator.gpu){
            const adapter=await self.navigator.gpu.requestAdapter();
            if(adapter) device="webgpu";
          }
        }catch(e){device=null;}
        const opts={dtype:"q8"};if(device)opts.device=device;
        try{
          tts=await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX",opts);
        }catch(e){
          if(device){tts=await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX",{dtype:"q8"});device=null;}
          else throw e;
        }
        self.postMessage({type:"ready",device:device||"cpu"});
      }else{
        self.postMessage({type:"ready",device:"cpu"});
      }
    }catch(err){
      self.postMessage({type:"error",error:String((err&&err.message)||err)});
    }
    return;
  }
  if(m.type==="speak"){
    if(!tts){self.postMessage({type:"result",id:m.id,ok:false,error:"not-ready"});return;}
    try{
      const audio=await tts.generate(m.text,{voice:m.voice});
      const copy=audio.audio.slice(); /* detach a clean buffer for transfer */
      self.postMessage({type:"result",id:m.id,ok:true,pcm:copy,sr:audio.sampling_rate||24000},[copy.buffer]);
    }catch(err){
      self.postMessage({type:"result",id:m.id,ok:false,error:String((err&&err.message)||err)});
    }
    return;
  }
};
