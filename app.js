// set up basic variables for app

const load = document.querySelector('.load');
const play = document.querySelector('.play');
const audioCtxDownlink = new AudioContext();
let buffer = null;

load.onclick = function() {
  const request = new XMLHttpRequest();
  request.open("GET", "fb_fc.wav");
  request.responseType = "arraybuffer";
  request.onload = function() {
    let undecodedAudio = request.response;
    audioCtxDownlink.decodeAudioData(undecodedAudio, (data) => buffer = data);
  };
  request.send();
}
	

play.onclick = function() {
  const source = audioCtxDownlink.createBufferSource();
  source.buffer = buffer;
  source.connect(audioCtxDownlink.destination);
  source.start();
};


//
const record = document.querySelector('.record');
const stop = document.querySelector('.stop');
const soundClips = document.querySelector('.sound-clips');
const canvas = document.querySelector('.visualizer');
const mainSection = document.querySelector('.main-controls');

// disable stop button while not recording

stop.disabled = true;

// visualiser setup - create web audio api context and canvas

let audioCtx;
const canvasCtx = canvas.getContext("2d");

//main block for doing the audio recording

// true on chrome, false on firefox
//console.log("audio/webm:"+MediaRecorder.isTypeSupported('audio/webm;codecs=opus'));
console.log("audio/webm:"+MediaRecorder.isTypeSupported('audio/webm;codecs=pcm'));
// false on chrome, true on firefox
//console.log("audio/ogg:"+MediaRecorder.isTypeSupported('audio/ogg;codecs=opus'));
console.log("audio/ogg:"+MediaRecorder.isTypeSupported('audio/ogg;codecs=pcm'));

//if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')){
if (MediaRecorder.isTypeSupported('audio/webm;codecs=pcm')){
	extension="webm";
}else{
	extension="ogg"
}

var constraints = {
    audio: {
        sampleRate: 48000,
        channelCount: 1,
        volume: 1.0,
		echoCancellation: false,
		noiseSuppression: false,
		autoGainControl: false,
    }
}

//if (navigator.mediaDevices.getUserMedia) {
if (navigator.mediaDevices.getUserMedia(constraints)) {
  console.log('getUserMedia supported.');

  //const constraints = { audio: true };
  var options = {
	  //mimeType : 'audio/'+extension+';codecs=opus'
	  //mimeType : 'audio/webm'+';codecs=pcm'
	  mimeType : 'audio/webm;codecs=pcm'
	  }
		
  let chunks = [];

  let onSuccess = function(stream) {


    //const mediaRecorder = new MediaRecorder(stream);
	const mediaRecorder = new MediaRecorder(stream, options);
	console.log("mediaRecoder.mimeType:" + mediaRecorder.mimeType);
	
    visualize(stream);

    record.onclick = function() {
      mediaRecorder.start();
      console.log(mediaRecorder.state);
      console.log("recorder started");
      record.style.background = "red";

      stop.disabled = false;
      record.disabled = true;
    }

    stop.onclick = function() {
      mediaRecorder.stop();
      console.log(mediaRecorder.state);
      console.log("recorder stopped");
      record.style.background = "";
      record.style.color = "";
      // mediaRecorder.requestData();

      stop.disabled = true;
      record.disabled = false;
    }

    mediaRecorder.onstop = function(e) {
      console.log("data available after MediaRecorder.stop() called.");

      const clipName = prompt('Enter a name for your sound clip?','My unnamed clip');

      const clipContainer = document.createElement('article');
      const clipLabel = document.createElement('p');
      const audio = document.createElement('audio');
      const deleteButton = document.createElement('button');

      clipContainer.classList.add('clip');
      audio.setAttribute('controls', '');
      deleteButton.textContent = 'Delete';
      deleteButton.className = 'delete';

      if(clipName === null) {
        clipLabel.textContent = 'My unnamed clip';
      } else {
        clipLabel.textContent = clipName;
      }

      clipContainer.appendChild(audio);
      clipContainer.appendChild(clipLabel);
      clipContainer.appendChild(deleteButton);
      soundClips.appendChild(clipContainer);

      audio.controls = true;
      //const blob = new Blob(chunks, { 'type' : 'audio/ogg; codecs=opus' });
	  //const blob = new Blob(chunks, { 'type' : 'audio/wav; codecs=pcm' });		// not sure this worked; filename was .wav, but not a valid wav file
	  const blob = new Blob(chunks, { 'type' : 'audio/webm; codecs=pcm' });		// not sure this worked; filename was .wav, but not a valid wav file	  
      chunks = [];
      const audioURL = window.URL.createObjectURL(blob);
      audio.src = audioURL;
      console.log("recorder stopped");

      deleteButton.onclick = function(e) {
        let evtTgt = e.target;
        evtTgt.parentNode.parentNode.removeChild(evtTgt.parentNode);
      }

      clipLabel.onclick = function() {
        const existingName = clipLabel.textContent;
        const newClipName = prompt('Enter a new name for your sound clip?');
        if(newClipName === null) {
          clipLabel.textContent = existingName;
        } else {
          clipLabel.textContent = newClipName;
        }
      }
    }

    mediaRecorder.ondataavailable = function(e) {
      chunks.push(e.data);
    }
  }

  let onError = function(err) {
    console.log('The following error occured: ' + err);
  }

  navigator.mediaDevices.getUserMedia(constraints).then(onSuccess, onError);

} else {
   console.log('getUserMedia not supported on your browser!');
}

function visualize(stream) {
  if(!audioCtx) {
    audioCtx = new AudioContext();
  }

  const source = audioCtx.createMediaStreamSource(stream);

  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  source.connect(analyser);
  //analyser.connect(audioCtx.destination);

  draw()

  function draw() {
    const WIDTH = canvas.width
    const HEIGHT = canvas.height;

    requestAnimationFrame(draw);

    analyser.getByteTimeDomainData(dataArray);

    canvasCtx.fillStyle = 'rgb(200, 200, 200)';
    canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = 'rgb(0, 0, 0)';

    canvasCtx.beginPath();

    let sliceWidth = WIDTH * 1.0 / bufferLength;
    let x = 0;


    for(let i = 0; i < bufferLength; i++) {

      let v = dataArray[i] / 128.0;
      let y = v * HEIGHT/2;

      if(i === 0) {
        canvasCtx.moveTo(x, y);
      } else {
        canvasCtx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    canvasCtx.lineTo(canvas.width, canvas.height/2);
    canvasCtx.stroke();

  }
}

window.onresize = function() {
  canvas.width = mainSection.offsetWidth;
}

window.onresize();