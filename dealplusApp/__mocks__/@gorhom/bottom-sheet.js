const React = require('react');
const { View, ScrollView, FlatList } = require('react-native');

const Sheet = React.forwardRef(({ children, onDismiss }, ref) => {
  React.useImperativeHandle(ref, () => ({
    present: () => {},
    dismiss: () => onDismiss?.(),
    snapToIndex: () => {},
    close: () => onDismiss?.(),
  }));
  return <View>{children}</View>;
});
Sheet.displayName = 'BottomSheetModal';

const PassThrough = ({ children }) => children ?? null;

module.exports = {
  __esModule: true,
  default: Sheet,
  BottomSheetModal: Sheet,
  BottomSheetModalProvider: PassThrough,
  BottomSheetView: View,
  BottomSheetScrollView: ScrollView,
  BottomSheetFlatList: FlatList,
  BottomSheetBackdrop: () => null,
  BottomSheetHandle: () => null,
  BottomSheetFooter: ({ children }) => children ?? null,
};
