import { useState } from 'react';
import { Dimensions, FlatList, Modal, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import Icon from 'react-native-vector-icons/Ionicons';

const PhotoViewer = ({ images, startIndex, onClose }) => {
  const { width: PW, height: PH } = Dimensions.get('window');
  const [current, setCurrent] = useState(startIndex);
  return (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <FlatList
          data={images}
          horizontal
          pagingEnabled
          initialScrollIndex={startIndex}
          getItemLayout={(_, i) => ({ length: PW, offset: PW * i, index: i })}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setCurrent(Math.round(e.nativeEvent.contentOffset.x / PW))}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => (
            <View style={{ width: PW, height: PH, alignItems: 'center', justifyContent: 'center' }}>
              <FastImage
                source={{ uri: item, priority: FastImage.priority.high, cache: FastImage.cacheControl.web }}
                style={{ width: PW, height: PH * 0.75 }}
                resizeMode={FastImage.resizeMode.contain}
              />
            </View>
          )}
        />
        {images.length > 1 && (
          <View style={styles.counter}>
            <Text style={styles.counterText}>{current + 1} / {images.length}</Text>
          </View>
        )}
        <Pressable onPress={onClose} hitSlop={12} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Close photo">
          <Icon name="close" size={20} color="#fff" />
        </Pressable>
      </View>
    </Modal>
  );
};

export default PhotoViewer;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  counter: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  counterText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  closeButton: {
    position: 'absolute',
    top: 52,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
