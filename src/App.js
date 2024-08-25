import React, { useRef, useState, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css';

const socket = io.connect('http://localhost:5000');

function App() {
    const userVideo = useRef();
    const peerVideo = useRef();
    const peerRef = useRef();
    const [isCallStarted, setIsCallStarted] = useState(false);
    const [userStream, setUserStream] = useState(null);

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
            setUserStream(null); // Correctly update the state
        }

        setIsCallStarted(false);
        peerVideo.current.srcObject = null;
        userVideo.current.srcObject = null;
    };

    const nextCall = () => {
        endCall();  // End the current call
        startCall();  // Start a new call
    };

    return (
        <div className="container">
            <video ref={userVideo} autoPlay muted></video>
            <video ref={peerVideo} autoPlay></video>
            {!isCallStarted && (
                <button onClick={startCall}>Start Call</button>
            )}
            {isCallStarted && (
                <>
                    <button onClick={endCall}>End Call</button>
                    <button onClick={nextCall}>Next</button>
                </>
            )}
        </div>
    );
}

export default App;
