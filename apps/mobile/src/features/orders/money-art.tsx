import Svg, { Circle, Defs, LinearGradient, Stop, Text as SvgText } from "react-native-svg";

/** 錢的圖形：一枚金幣（外圈、內圈、$ 符號、一道反光）。自己畫的向量圖，不用外部圖片。 */
export function MoneyArt({ size = 96 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityElementsHidden>
      <Defs>
        <LinearGradient id="coin" x1="0.1" y1="0" x2="0.9" y2="1">
          <Stop offset="0" stopColor="#FFE9A3" />
          <Stop offset="0.55" stopColor="#F2C063" />
          <Stop offset="1" stopColor="#D49A2A" />
        </LinearGradient>
      </Defs>
      <Circle cx="50" cy="50" r="46" fill="#B8791A" />
      <Circle cx="50" cy="50" r="43" fill="url(#coin)" />
      <Circle cx="50" cy="50" r="33" fill="none" stroke="#C98A1B" strokeWidth="3" />
      <SvgText x="50" y="64" fontSize="44" fontWeight="900" fill="#9A6510" textAnchor="middle">
        $
      </SvgText>
      <Circle cx="30" cy="28" r="6" fill="#FFFFFF" opacity="0.55" />
    </Svg>
  );
}
