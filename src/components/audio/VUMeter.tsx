interface VUMeterProps {
  level: number;
  orientation?: 'vertical' | 'horizontal';
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: { width: 12, height: 64 },
  md: { width: 16, height: 96 },
  lg: { width: 20, height: 128 },
};

export function VUMeter({ level, orientation = 'vertical', size = 'md' }: VUMeterProps) {
  const dimensions = sizeMap[size];

  const getColor = (l: number) => {
    if (l > 0.85) return '#ef4444';
    if (l > 0.7) return '#facc15';
    return '#22c55e';
  };

  if (orientation === 'horizontal') {
    return (
      <div style={{
        position: 'relative',
        backgroundColor: '#1e293b',
        borderRadius: 2,
        overflow: 'hidden',
        border: '1px solid #334155',
        height: 16,
        width: '100%',
      }}>
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            borderRadius: 2,
            width: `${level * 100}%`,
            backgroundColor: getColor(level),
            transition: 'width 50ms linear, background-color 50ms linear',
          }}
        />
      </div>
    );
  }

  return (
    <div style={{
      position: 'relative',
      backgroundColor: '#1e293b',
      borderRadius: 2,
      overflow: 'hidden',
      border: '1px solid #334155',
      width: dimensions.width,
      height: dimensions.height,
    }}>
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          borderRadius: 2,
          height: `${level * 100}%`,
          backgroundColor: getColor(level),
          transition: 'height 50ms linear, background-color 50ms linear',
        }}
      />
    </div>
  );
}

export default VUMeter;
