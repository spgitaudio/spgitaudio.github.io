// set up basic variables for app
// set up for downlink playback (fetch/load wav file from webserver, play locally over loudspeaker)

let dropdown = document.getElementById('far-filename-dropdown');
dropdown.length = 0;

let defaultOption = document.createElement('option');
defaultOption.text = 'Choose a wav';

dropdown.add(defaultOption);
dropdown.selectedIndex = 0;

//const url = 'https://api.myjson.com/bins/7xq2x';
//const url = 'provinces.json';
const url = 'list_of_wav_filenames.json';

// use fetch to retrieve the list of wav filenames and then populate the dropdown list
// report any errors that occur in the fetch operation
// 
fetch(url)
	.then(
		function (response) {
			if (response.status !== 200) {
				console.warn('Looks like there was a problem. Status Code: ' + response.status);
				return;
			}

			// Examine the text in the response and populate the dropdown with the filenames
			response.json().then(function (data) {
				let option;

				for (let i = 0; i < data.length; i++) {
					option = document.createElement('option');
					option.text = data[i].name;
					option.value = data[i].name;
					dropdown.add(option);
				}
			});
		}
	)
	.catch(function (err) {
		console.error('Fetch Error -', err);
	});


const loadButton = document.querySelector('.load');
const playButton = document.querySelector('.play');
const stopfarButton = document.querySelector('.stop-far');
const audioCtxDownlink = new AudioContext();
let buffer = null;

//add events to the buttons
loadButton.addEventListener("click", loadFarFile);
playButton.addEventListener("click", playFarFile);
stopfarButton.addEventListener("click", stopFarFile);

let farFilename = ''

/*
  Disable the play and stopfar buttons until we successfully fetch the selected file 
*/
loadButton.disabled = false;
playButton.disabled = true;
stopfarButton.disabled = true;

function loadFarFile() {
	console.log("loadButton clicked");
	farFilename = dropdown.options[dropdown.selectedIndex].value;
	console.log("selected " + farFilename);

	fetch(farFilename)
		.then(function (response) {
			if (response.status !== 200) {
				console.warn('loadFarFile has a problem. Status Code: ' + response.status);
				console.warn('loadFarFile could not load ', farFilename);
				return;
			}
			return response.arrayBuffer()
		}).
		then(function (arrayBuffer) {
			if (arrayBuffer) {
				let undecodedAudio = arrayBuffer;
				audioCtxDownlink.decodeAudioData(undecodedAudio, (data) => buffer = data);

				// update the displayed loaded file
				document.getElementById("loaded_file").innerHTML = "Loaded: " + farFilename

				// enable the buttons now that we have successfully downloaded a file
				playButton.disabled = false;
				stopfarButton.disabled = false;
			}
		})
		.catch(function (err) {
			console.error('loadFarFile Error - ', err);
		});
}

var source = null;

function playFarFile() {
	console.log("playButton clicked");
	source = audioCtxDownlink.createBufferSource();
	source.buffer = buffer;
	source.connect(audioCtxDownlink.destination);
	source.start();
}


function stopFarFile() {
	console.log("stopfarButton clicked");
	source.stop();
}


//////////////////////////////////////////////////////////////////////////////////////////
// set up for local recording
const recordButton = document.querySelector('.record');
const stopButton = document.querySelector('.stop');
const recordAndPlayButton = document.querySelector('.record_and_play');
const soundClips = document.querySelector('.sound-clips');
const canvas = document.querySelector('.visualizer');
const mainSection = document.querySelector('.main-controls');


// visualiser setup - create web audio api context and canvas
const canvasCtx = canvas.getContext("2d");

//webkitURL is deprecated but nevertheless
URL = window.URL || window.webkitURL;

var gumStream; 						//stream from getUserMedia()
var rec; 							//Recorder.js object
var input; 							//MediaStreamAudioSourceNode we'll be recording

// shim for AudioContext when it's not avb. 
var AudioContext = window.AudioContext || window.webkitAudioContext;
var audioContext //audio context to help us record

//var recordButton = document.getElementById("recordButton");
//var stopButton = document.getElementById("stopButton");
//var pauseButton = document.getElementById("pauseButton");

//add events to the near side buttons
recordButton.addEventListener("click", startRecording);
stopButton.addEventListener("click", stopRecording);
recordAndPlayButton.addEventListener("click", startRecordingAndPlay);
//pauseButton.addEventListener("click", pauseRecording);

function startRecording() {
	console.log("recordButton clicked");

	/*
		Simple constraints object, for more advanced audio features see
		https://addpipe.com/blog/audio-constraints-getusermedia/
	*/

	//var constraints = { audio: true, video: false }
	var constraints = {
		audio: {
			sampleRate: 48000,
			channelCount: 2,
			volume: 1.0,
			echoCancellation: false,
			noiseSuppression: false,
			autoGainControl: false
		},
		video: false
	}

	/*
	  Disable the record button until we get a success or fail from getUserMedia() 
	*/

	recordButton.disabled = true;
	stopButton.disabled = false;
	//pauseButton.disabled = false

	/*
		We're using the standard promise based getUserMedia() 
		https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
	*/

	navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
		console.log("getUserMedia() success, stream created, initializing Recorder.js ...");

		/*
			create an audio context after getUserMedia is called
			sampleRate might change after getUserMedia is called, like it does on macOS when recording through AirPods
			the sampleRate defaults to the one set in your OS for your playback device

		*/
		audioContext = new AudioContext();

		//update the format 
		document.getElementById("formats").innerHTML = "Format: 1 channel pcm @ " + audioContext.sampleRate / 1000 + "kHz"

		/*  assign to gumStream for later use  */
		gumStream = stream;

		/* use the stream */
		input = audioContext.createMediaStreamSource(stream);

		/* 
			Create the Recorder object and configure to record mono sound (1 channel)
			Recording 2 channels  will double the file size
		*/
		rec = new Recorder(input, { numChannels: 1 })

		visualize(stream);

		//start the recording process
		rec.record()

		console.log("Recording started");

	}).catch(function (err) {
		//enable the record button if getUserMedia() fails
		recordButton.disabled = false;
		stopButton.disabled = true;
		//pauseButton.disabled = true
	});
}

function startRecordingAndPlay() {
	console.log("recordAndPlayButton clicked");
	startRecording();

	source = audioCtxDownlink.createBufferSource();
	source.buffer = buffer;
	source.connect(audioCtxDownlink.destination);
	// Start playback 1 second after the current time so that we're confident that recording has started
	// and reduces the chance that we miss the first portion of the far file
	source.start(audioCtxDownlink.currentTime + 1.0);
}

function pauseRecording() {
	console.log("pauseButton clicked rec.recording=", rec.recording);
	if (rec.recording) {
		//pause
		rec.stop();
		//pauseButton.innerHTML = "Resume";
	} else {
		//resume
		rec.record()
		//pauseButton.innerHTML = "Pause";

	}
}

function stopRecording() {
	console.log("stopButton clicked");

	//disable the stop button, enable the record too allow for new recordings
	stopButton.disabled = true;
	recordButton.disabled = false;
	//pauseButton.disabled = true;

	//reset button just in case the recording is stopped while paused
	//pauseButton.innerHTML = "Pause";

	//tell the recorder to stop the recording
	rec.stop();

	//stop microphone access
	gumStream.getAudioTracks()[0].stop();

	//create the wav blob and pass it on to createDownloadLink
	rec.exportWAV(createDownloadLink);
}

function createDownloadLink(blob) {

	var url = URL.createObjectURL(blob);
	var au = document.createElement('audio');
	var li = document.createElement('li');
	var link = document.createElement('a');

	//name of .wav file to use during upload and download (without extendion)
	var filename = new Date().toISOString();

	//add controls to the <audio> element
	au.controls = true;
	au.src = url;

	//save to disk link
	link.href = url;
	//link.download = filename + ".wav"; //download forces the browser to donwload the file using the  filename

	// append the name of the file that was played over the loudspeaker so that we can easily pair with the reference
	recordedFilename = filename + "." + farFilename.substr(0, farFilename.lastIndexOf(".")) + ".wav";
	link.download = recordedFilename; //download forces the browser to donwload the file using the recordedFilename
	link.innerHTML = "Save to disk";

	//add the new audio element to li
	li.appendChild(au);

	//add the filename to the li
	//li.appendChild(document.createTextNode(filename + ".wav "))
	li.appendChild(document.createTextNode(recordedFilename))

	//add the save to disk link to li
	li.appendChild(link);

	////upload link
	//var upload = document.createElement('a');
	//upload.href = "#";
	//upload.innerHTML = "Upload";
	//upload.addEventListener("click", function (event) {
	//	var xhr = new XMLHttpRequest();
	//	xhr.onload = function (e) {
	//		if (this.readyState === 4) {
	//			console.log("Server returned: ", e.target.responseText);
	//		}
	//	};
	//	var fd = new FormData();
	//	fd.append("audio_data", blob, filename);
	//	xhr.open("POST", "upload.php", true);
	//	xhr.send(fd);
	//})
	//li.appendChild(document.createTextNode(" "))//add a space in between
	//li.appendChild(upload)//add the upload link to li

	const deleteButton = document.createElement('button');
	deleteButton.textContent = 'Delete';
	deleteButton.className = 'delete';
	li.appendChild(deleteButton);

	//add the li element to the ol
	recordingsList.appendChild(li);


    deleteButton.onclick = function(e) {
    let evtTgt = e.target;
    evtTgt.parentNode.parentNode.removeChild(evtTgt.parentNode);
    }
}

//////////////////////////////////////////////////////////////////////////

//// true on chrome, false on firefox
////console.log("audio/webm:"+MediaRecorder.isTypeSupported('audio/webm;codecs=opus'));
//console.log("audio/webm:"+MediaRecorder.isTypeSupported('audio/webm;codecs=pcm'));
//// false on chrome, true on firefox
////console.log("audio/ogg:"+MediaRecorder.isTypeSupported('audio/ogg;codecs=opus'));
//console.log("audio/ogg:"+MediaRecorder.isTypeSupported('audio/ogg;codecs=pcm'));

////if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')){
//if (MediaRecorder.isTypeSupported('audio/webm;codecs=pcm')){
//	extension="webm";
//}else{
//	extension="ogg"
//}

//var constraints = {
//    audio: {
//        sampleRate: 48000,
//        channelCount: 1,
//        volume: 1.0,
//		echoCancellation: false,
//		noiseSuppression: false,
//		autoGainControl: false,
//    }
//}

////if (navigator.mediaDevices.getUserMedia) {
//if (navigator.mediaDevices.getUserMedia(constraints)) {
//  console.log('getUserMedia supported.');

//  //const constraints = { audio: true };
//  var options = {
//	  //mimeType : 'audio/'+extension+';codecs=opus'
//	  //mimeType : 'audio/webm'+';codecs=pcm'
//	  mimeType : 'audio/webm;codecs=pcm'
//	  }
		
//  let chunks = [];

//  let onSuccess = function(stream) {


//    //const mediaRecorder = new MediaRecorder(stream);
//	const mediaRecorder = new MediaRecorder(stream, options);
//	console.log("mediaRecoder.mimeType:" + mediaRecorder.mimeType);
	
//    visualize(stream);

//    record.onclick = function() {
//      mediaRecorder.start();
//      console.log(mediaRecorder.state);
//      console.log("recorder started");
//      record.style.background = "red";

//      stop.disabled = false;
//      record.disabled = true;
//    }

//    stop.onclick = function() {
//      mediaRecorder.stop();
//      console.log(mediaRecorder.state);
//      console.log("recorder stopped");
//      record.style.background = "";
//      record.style.color = "";
//      // mediaRecorder.requestData();

//      stop.disabled = true;
//      record.disabled = false;
//    }

//    mediaRecorder.onstop = function(e) {
//      console.log("data available after MediaRecorder.stop() called.");

//      const clipName = prompt('Enter a name for your sound clip?','My unnamed clip');

//      const clipContainer = document.createElement('article');
//      const clipLabel = document.createElement('p');
//      const audio = document.createElement('audio');
//      const deleteButton = document.createElement('button');

//      clipContainer.classList.add('clip');
//      audio.setAttribute('controls', '');
//      deleteButton.textContent = 'Delete';
//      deleteButton.className = 'delete';

//      if(clipName === null) {
//        clipLabel.textContent = 'My unnamed clip';
//      } else {
//        clipLabel.textContent = clipName;
//      }

//      clipContainer.appendChild(audio);
//      clipContainer.appendChild(clipLabel);
//      clipContainer.appendChild(deleteButton);
//      soundClips.appendChild(clipContainer);

//      audio.controls = true;
//      //const blob = new Blob(chunks, { 'type' : 'audio/ogg; codecs=opus' });
//	  //const blob = new Blob(chunks, { 'type' : 'audio/wav; codecs=pcm' });		// not sure this worked; filename was .wav, but not a valid wav file
//	  const blob = new Blob(chunks, { 'type' : 'audio/webm; codecs=pcm' });		// not sure this worked; filename was .wav, but not a valid wav file	  
//      chunks = [];
//      const audioURL = window.URL.createObjectURL(blob);
//      audio.src = audioURL;
//      console.log("recorder stopped");

//      deleteButton.onclick = function(e) {
//        let evtTgt = e.target;
//        evtTgt.parentNode.parentNode.removeChild(evtTgt.parentNode);
//      }

//      clipLabel.onclick = function() {
//        const existingName = clipLabel.textContent;
//        const newClipName = prompt('Enter a new name for your sound clip?');
//        if(newClipName === null) {
//          clipLabel.textContent = existingName;
//        } else {
//          clipLabel.textContent = newClipName;
//        }
//      }
//    }

//    mediaRecorder.ondataavailable = function(e) {
//      chunks.push(e.data);
//    }
//  }

//  let onError = function(err) {
//    console.log('The following error occured: ' + err);
//  }

//  navigator.mediaDevices.getUserMedia(constraints).then(onSuccess, onError);

//} else {
//   console.log('getUserMedia not supported on your browser!');
//}

function visualize(stream) {
  if(!audioContext) {
	  audioContext = new AudioContext();
  }

  const source = audioContext.createMediaStreamSource(stream);

  const analyser = audioContext.createAnalyser();
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