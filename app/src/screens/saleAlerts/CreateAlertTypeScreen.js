import { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import useCreateAlertDraftStore from '../../state/createAlertDraftStore';

/** Brand tracking is paused — jump straight into the product create flow. */
const CreateAlertTypeScreen = () => {
  const navigation = useNavigation();
  const setField = useCreateAlertDraftStore((s) => s.setField);

  useEffect(() => {
    setField('alertType', 'product');
    navigation.replace('AddProductUrlScreen');
  }, [navigation, setField]);

  return null;
};

export default CreateAlertTypeScreen;
