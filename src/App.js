import React, { useRef, useState, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css';
import { FiMicOff, FiVideoOff, FiCamera } from 'react-icons/fi';

const socket = io.connect('https://video-calling-backend-1.onrender.com'); // Replace with your backend URL

function App() {
  const userVideo = useRef(null);
  const peerVideo = useRef(null);
  const peerRef = useRef(null);
  const [isCallStarted, setIsCallStarted] = useState(false);
  const [userStream, setUserStream] = useState(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [loading, setLoading] = useState(false);

  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' }
    ]
  };

  useEffect(() => {
    socket.on('signal', async (data) => {
      const peer = peerRef.current;
      if (!peer) return;

      try {
        if (data.type === 'offer') {
          if (peer.signalingState === 'stable') {
            throw new Error('Peer connection is not in the right state.');
          }
          await peer.setRemoteDescription(new RTCSessionDescription(data));
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          socket.emit('signal', peer.localDescription);
        } else if (data.type === 'answer') {
          if (peer.signalingState === 'stable') {
            throw new Error('Peer connection is not in the right state.');
          }
          await peer.setRemoteDescription(new RTCSessionDescription(data));
        } else if (data.candidate) {
          if (peer.signalingState === 'closed') {
            throw new Error('Peer connection is closed.');
          }
          const candidate = new RTCIceCandidate(data.candidate);
          await peer.addIceCandidate(candidate);
        }
      } catch (error) {
        console.error('Error in signaling process:', error);
      }
    });

    return () => {
      socket.off('signal');
    };
  }, []);

  const startCall = () => {
    setIsCallStarted(true);
    setLoading(true);

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        if (userVideo.current) {
          userVideo.current.srcObject = stream;
        } else {
          console.error('User video element not found');
        }

        setUserStream(stream);

        if (peerRef.current) {
          peerRef.current.close();
        }

        const peer = new RTCPeerConnection(configuration);
        peerRef.current = peer;

        peer.ontrack = (event) => {
          if (peerVideo.current) {
            peerVideo.current.srcObject = event.streams[0];
          } else {
            console.error('Peer video element not found');
          }
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

        setLoading(false);
      })
      .catch(error => {
        console.error('Error accessing media devices:', error);
        setLoading(false);
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
    if (peerVideo.current) {
      peerVideo.current.srcObject = null;
    }
    if (userVideo.current) {
      userVideo.current.srcObject = null;
    }
  };

  const toggleMic = () => {
    const enabled = !micEnabled;
    setMicEnabled(enabled);
    if (userStream) {
      userStream.getAudioTracks()[0].enabled = enabled;
    }
  };

  const toggleCamera = () => {
    const enabled = !cameraEnabled;
    setCameraEnabled(enabled);
    if (userStream) {
      userStream.getVideoTracks()[0].enabled = enabled;
    }
  };

  const nextCall = () => {
    endCall();
    startCall();
  };

  return (
    <div className="app">
      <div className="logo">
        <h2>Hello-Friend</h2>
        <span>by Sayed Soeb</span>
      </div>
      <div className="container">
        {loading && <div className="loader">Searching user...</div>}
        {!loading && (
          <div className="video-container">
            <video ref={userVideo} autoPlay muted playsInline></video>
            <video ref={peerVideo} autoPlay playsInline></video>
          </div>
        )}
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
    </div>
  );
}

export default App;
