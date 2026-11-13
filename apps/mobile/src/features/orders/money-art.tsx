import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Rect, Stop, Text as SvgText } from "react-native-svg";

/** 錢的圖形：一疊金幣＋一張鈔票（自己畫的向量圖，不用外部圖片）。 */
export function MoneyArt({ size = 120 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" accessibilityElementsHidden>
      <Defs>
        <LinearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFE58A" />
          <Stop offset="0.5" stopColor="#F2C063" />
          <Stop offset="1" stopColor="#C98A1B" />
        </LinearGradient>
        <LinearGradient id="note" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#7BC79B" />
          <Stop offset="1" stopColor="#2F8A5B" />
        </LinearGradient>
      </Defs>
      {/* 鈔票（斜放在後面） */}
      <Rect x="14" y="26" width="76" height="44" rx="6" fill="url(#note)" transform="rotate(-12 52 48)" />
      <Circle cx="52" cy="48" r="11" fill="none" stroke="#E9F7EF" strokeWidth="3" transform="rotate(-12 52 48)" />
      <Path d="M22 36 h8 M74 60 h8" stroke="#E9F7EF" strokeWidth="3" strokeLinecap="round" transform="rotate(-12 52 48)" />
      {/* 金幣一疊 */}
      {[0, 1, 2].map((i) => (
        <Ellipse key={`s${i}`} cx="82" cy={92 - i * 11} rx="26" ry="9" fill="#B8791A" />
      ))}
      {[0, 1, 2].map((i) => (
        <Ellipse key={`t${i}`} cx="82" cy={88 - i * 11} rx="26" ry="9" fill="url(#gold)" stroke="#B8791A" strokeWidth="1.5" />
      ))}
      <SvgText x="82" y="71" fontSize="16" fontWeight="900" fill="#8A5A0E" textAnchor="middle">
        $
      </SvgText>
    </Svg>
  );
}
