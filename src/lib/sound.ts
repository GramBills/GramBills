let audioContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const AudioContextClass =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextClass) {
    return null;
  }
  if (!audioContext) {
    audioContext = new AudioContextClass();
  }
  return audioContext;
}

function tone(
  frequency: number,
  start: number,
  duration: number,
  volume = 0.04,
): void {
  const context = getContext();
  if (!context) {
    return;
  }
  if (context.state === 'suspended') {
    void context.resume();
  }
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(volume, context.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    context.currentTime + start + duration,
  );
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(context.currentTime + start);
  oscillator.stop(context.currentTime + start + duration);
}

export function playScanBeep(): void {
  tone(880, 0, 0.08, 0.03);
}

export function playCheckoutChime(): void {
  tone(660, 0, 0.1, 0.035);
  tone(880, 0.1, 0.12, 0.035);
  tone(1100, 0.22, 0.16, 0.03);
}
