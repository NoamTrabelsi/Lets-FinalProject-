import * as React from "react";
import { StyleProp, ViewStyle, StyleSheet } from "react-native";
import { Image } from "expo-image";

const VectorIcon1 = ({ style }) => {
  return (
    <Image
      style={[styles.vectorIcon, style]}
      contentFit="cover"
      source={require("../assets/vector11.png")}
    />
  );
};

const styles = StyleSheet.create({
  vectorIcon: {
    width: 36,
    height: 33,
  },
});

export default VectorIcon1;