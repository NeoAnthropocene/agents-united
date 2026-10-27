import React from 'react';
import { Composition } from 'remotion';
import { AgencyMotion } from './Composition.jsx';
import inputProps from './input-props.json';

export function RemotionRoot() {
  return <Composition id="AgencyMotion" component={AgencyMotion} defaultProps={inputProps}
    durationInFrames={inputProps.timeline.totalFrames} fps={inputProps.timeline.fps}
    width={inputProps.timeline.width} height={inputProps.timeline.height}
    calculateMetadata={({ props }) => ({ durationInFrames: props.timeline.totalFrames,
      fps: props.timeline.fps, width: props.timeline.width, height: props.timeline.height })} />;
}
