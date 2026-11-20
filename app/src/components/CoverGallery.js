import { useState } from 'react';
import { Dimensions, FlatList, StyleSheet, View } from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import Icon from 'react-native-vector-icons/Ionicons';

const { width: SCREEN_W } = Dimensions.get('window');

/** Swipeable hero image gallery — paginated, with a dot indicator and a
 * placeholder slide when no images are available. */
const CoverGallery = ({ images, height }) => {
  const [idx, setIdx] = useState(0);
  const list = images && images.length > 0 ? images : [null];

  return (
    <View style={[styles.wrap, { height }]}>
      <FlatList
        data={list}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIdx(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) =>
          item ? (
            <FastImage
              source={{ uri: item, priority: FastImage.priority.high, cache: FastImage.cacheControl.web }}
              style={[styles.slide, { height }]}
              resizeMode={FastImage.resizeMode.cover}
            />
          ) : (
            <View style={[styles.slide, styles.placeholder, { height }]}>
              <Icon name="image-outline" size={48} color="rgba(255,255,255,0.3)" />
            </View>
          )
        }
      />
      {list.length > 1 && (
        <View style={styles.dots}>
          {list.map((_, i) => (
            <View key={i} style={[styles.dot, i === idx && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
};

export default CoverGallery;

const styles = StyleSheet.create({
  wrap: { width: SCREEN_W },
  slide: { width: SCREEN_W },
  placeholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a2a3a' },
  dots: { position: 'absolute', bottom: 12, alignSelf: 'center', flexDirection: 'row', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { backgroundColor: '#fff', width: 18 },
});
