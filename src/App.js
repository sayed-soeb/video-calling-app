import React, { useRef, useState, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css';
import { FiMicOff, FiVideoOff, FiCamera } from 'react-icons/fi';

const socket = io.connect('http://localhost:5000');

function App() {
  const userVideo = useRef();
  const peerVideo = useRef();
  const peerRef = useRef();
  const [isCallStarted, setIsCallStarted] = useState(false);
  const [userStream, setUserStream] = useState(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);

  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' }
    ]
  };

  useEffect(() => {
    socket.on('signal', async (data) => {
      const peer = peerRef.current;
      if (!peer) return;

      if (data.type === 'offer') {
        await peer.setRemoteDescription(new RTCSessionDescription(data));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit('signal', peer.localDescription);
      } else if (data.type === 'answer') {
        await peer.setRemoteDescription(new RTCSessionDescription(data));
      } else if (data.candidate) {
        try {
          const candidate = new RTCIceCandidate(data.candidate);
          await peer.addIceCandidate(candidate);
        } catch (error) {
          console.error('Error adding received ICE candidate', error);
        }
      }
    });

    return () => {
      socket.off('signal');
    };
  }, []);

  const startCall = () => {
    setIsCallStarted(true);

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        userVideo.current.srcObject = stream;
        setUserStream(stream);

        if (peerRef.current) {
          peerRef.current.close();
        }

        const peer = new RTCPeerConnection(configuration);
        peerRef.current = peer;

        peer.ontrack = (event) => {
          peerVideo.current.srcObject = event.streams[0];
        };

        peer.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('signal', { candidate: event.candidate });
          }
        };

        stream.getTracks().forEach(track => peer.addTrack(track, stream));

        peer.createOffer().then(offer => {
          peer.setLocalDescription(offer);
          socket.emit('signal', offer);
        });
      })
      .catch(error => {
        console.error('Error accessing media devices.', error);
      });
  };

  const endCall = () => {
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }

    if (userStream) {
      userStream.getTracks().forEach(track => track.stop());
      setUserStream(null);
    }

    setIsCallStarted(false);
    peerVideo.current.srcObject = null;
    userVideo.current.srcObject = null;
  };

  const toggleMic = () => {
    const enabled = !micEnabled;
    setMicEnabled(enabled);
    userStream.getAudioTracks()[0].enabled = enabled;
  };

  const toggleCamera = () => {
    const enabled = !cameraEnabled;
    setCameraEnabled(enabled);
    userStream.getVideoTracks()[0].enabled = enabled;
  };

  const nextCall = () => {
    endCall();
    startCall();
  };

  return (
    <>
      <div className="logo">
        <h2>Hello-Friend</h2>
        <span>by Sayed Soeb</span>
      </div>
      <div className="container">
        <div className="video-container">
          <video ref={userVideo} autoPlay muted></video>
          <video ref={peerVideo} autoPlay></video>
        </div>
        <div className="button-container">
          {!isCallStarted && (
            <button onClick={startCall}>Start</button>
          )}
          {isCallStarted && (
            <>
              <button onClick={endCall}>End</button>
              <button onClick={nextCall}>Next</button>
              <button onClick={toggleMic}>
                <FiMicOff color={micEnabled ? '#fff' : '#d32f2f'} />
              </button>
              <button onClick={toggleCamera}>
                <FiVideoOff color={cameraEnabled ? '#fff' : '#d32f2f'} />
              </button>
              <button>
                <FiCamera />
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default App;
