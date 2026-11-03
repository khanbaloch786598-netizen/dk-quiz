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
      if(!tts) tts=await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX",{dtype:"q8"});
      self.postMessage({type:"ready"});
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
