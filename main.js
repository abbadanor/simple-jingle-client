import './style.css'
import adapter from 'webrtc-adapter';
import * as XMPP from "stanza"

var client;

var localMedia = [];

var loginInfo = document.getElementById('loginInfo');

function log(text) {
  if(text.includes("error")) {
    console.error(text)
  } else {
    console.log(text)
  }
}


loginInfo.addEventListener("submit", (e) => {
  if (e.preventDefault) e.preventDefault();

  var jid = document.getElementById('jid').value;
  var username = jid.slice(0, jid.indexOf('@'));
  var server = jid.slice(jid.indexOf('@') + 1);

  var url = document.getElementById('url').value;
  var transports = {
    bosh: true,
    websocket: true
  };
  if (url.indexOf('http') === 0) {
    transports.bosh = url;
    transports.websocket = false;
  } else if (url.indexOf('ws') === 0) {
    transports.websocket = url;
    transports.bosh = false;
  }

  client = XMPP.createClient({
    jid: jid,
    password: document.getElementById('password').value,
    transports: transports,
    allowResumption: false
  });

  client.on('raw:incoming', function (data) {
    log("<<in " + data)
  });
  client.on('raw:outgoing', function (data) {
    log('out>> ' + data);
  });

  client.on('session:started', function () {
    client.getRoster();
    client.sendPresence();
    client.discoverICEServers();
    document.getElementById('myJID').textContent = client.jid;
  });

  client.jingle.on('peerTrackAdded', function (session, track, stream) {
    if (track.kind === 'video') {
      const vid = document.getElementById('remoteVideo');
      vid.srcObject = stream;
      vid.muted = true;
      vid.play();
    }
  });

  client.on('jingle:incoming', function (session) {
    if (session.addTrack) {
      for (const stream of localMedia) {
        for (const track of stream.getTracks()) {
          session.addTrack(track, stream);
        }
      }
    }
    session.accept();
  });

  client.jingle.on('log', console.log);
  client.jingle.on('sentFile', function (session, metadata) {
    console.log('sent', metadata);
  });
  client.jingle.on('receivedFile', function (session, file, metadata) {
    //saveAs(file, metadata.name); // -- https://github.com/eligrey/FileSaver.js
    var href = document.getElementById('received');
    href.href = URL.createObjectURL(file);
    href.download = metadata.name;
    var text =
      'Click to download ' + metadata.name + ' (' + metadata.size + ' bytes)';
    href.appendChild(document.createTextNode(text));
    href.style.display = 'block';
  });
  var media;
  if (document.getElementById('screen').checked) {
    media = navigator.mediaDevices.getDisplayMedia({ video: true });
  } else {
    media = navigator.mediaDevices.getUserMedia({ audio: true, video: true });
  }
  media.then(stream => {
    const vid = document.getElementById('localVideo');
    vid.srcObject = stream;
    vid.muted = true;
    vid.play();

    localMedia.push(stream);
  });
  client.connect();

  var callInfo = document.getElementById('callInfo');
  callInfo.onsubmit = function (e) {
    e.preventDefault();
    var jid = document.getElementById('peer').value;
    var session = client.jingle.createMediaSession(jid);
    for (const stream of localMedia) {
      for (const track of stream.getTracks()) {
        session.addTrack(track, stream);
      }
    }
    session.start();
    return false;
  };

  return false;
})

// file select
function handleFileSelect(evt) {
  var file = evt.target.files[0]; // FileList object
  console.log('file', file.name, file.size, file.type, file.lastModifiedDate);
  var jid = document.getElementById('filepeer').value;
  var sess = client.jingle.createFileTransferSession(jid);
  sess.start(file);
}
document.getElementById('files').addEventListener('change', handleFileSelect, false);

function takeSnapshot() {
  var canvasEl = document.createElement('canvas');
  var localVideoEl = document.getElementById('localVideo');
  var w = 320; //localVideoEl.videoWidth;
  var h = 240; //localVideoEl.videoHeight;
  canvasEl.width = w;
  canvasEl.height = h;
  var context = canvasEl.getContext('2d');

  context.fillRect(0, 0, w, h);
  context.translate(w / 2, h / 2);
  context.scale(-1, 1);
  context.translate(w / -2, h / -2);
  context.drawImage(localVideoEl, 0, 0, w, h);
  // toBlob would be nice...
  var url = canvasEl.toDataURL('image/jpg');
  var data = url.match(/data:([^;]*);(base64)?,([0-9A-Za-z+/]+)/);
  var raw = atob(data[3]);
  var arr = new Uint8Array(raw.length);
  for (var i = 0; i < raw.length; i++) {
    arr[i] = raw.charCodeAt(i);
  }
  return new Blob([arr], { type: data[1] });
}
var snapshot = document.getElementById('snapshot');
snapshot.onsubmit = function (e) {
  e.preventDefault();
  var file = takeSnapshot();
  file.name = 'snapshot-' + new Date().getTime() + '.png';
  file.lastModifiedDate = new Date();
  console.log('file', file.name, file.size, file.type, file.lastModifiedDate);
  var jid = document.getElementById('snappeer').value;
  var sess = client.jingle.createFileTransferSession(jid);
  sess.start(file);
  return false;
};
