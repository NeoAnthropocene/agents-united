import React from 'react';
import { AbsoluteFill, Html5Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { frameState } from './frame-state.mjs';

function SceneCard({ scene, text, theme }) {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const state = frameState(frame, scene.endFrame - scene.startFrame);
  return <AbsoluteFill style={{ padding: width * 0.075, justifyContent: 'center',
    backgroundColor: theme.background, color: theme.foreground, fontFamily: 'sans-serif' }}>
    <div style={{ width: 72, height: 8, marginBottom: 36, backgroundColor: theme.accent }} />
    <h1 style={{ margin: 0, maxWidth: '85%', fontSize: width * 0.055, lineHeight: 1.1,
      opacity: state.opacity, transform: `translateY(${state.translateY}px)` }}>{text}</h1>
  </AbsoluteFill>;
}

export function AgencyMotion({ timeline, sceneText, theme, audioSrc }) {
  return <AbsoluteFill style={{ backgroundColor: theme.background }}>
    {timeline.scenes.map(scene => <Sequence key={scene.id} from={scene.startFrame}
      durationInFrames={scene.endFrame - scene.startFrame}>
      <SceneCard scene={scene} text={sceneText[scene.id] ?? scene.id} theme={theme} />
    </Sequence>)}
    {audioSrc ? <Html5Audio src={staticFile(audioSrc)} /> : null}
  </AbsoluteFill>;
}
