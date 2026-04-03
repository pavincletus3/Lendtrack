import { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as Contacts from 'expo-contacts';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';

interface Contact {
  id: string;
  name: string;
  phone: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (name: string, phone: string) => void;
}

export function ContactPickerModal({ visible, onClose, onSelect }: Props) {
  const { colors } = useTheme();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    loadContacts();
  }, [visible]);

  async function loadContacts() {
    setLoading(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Please allow contacts access in Settings.');
        onClose();
        return;
      }
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
        sort: Contacts.SortTypes.FirstName,
      });
      const list: Contact[] = [];
      for (const c of data) {
        if (c.phoneNumbers && c.phoneNumbers.length > 0 && c.name) {
          list.push({
            id: c.id ?? c.name,
            name: c.name,
            phone: c.phoneNumbers[0].number ?? '',
          });
        }
      }
      setContacts(list);
    } finally {
      setLoading(false);
    }
  }

  const filtered = query.trim()
    ? contacts.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.phone.includes(query)
      )
    : contacts;

  const s = styles(colors);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.container}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>Pick a contact</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={s.searchRow}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} style={s.searchIcon} />
          <TextInput
            style={s.searchInput}
            placeholder="Search name or number..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoFocus
            clearButtonMode="while-editing"
          />
        </View>

        {loading ? (
          <ActivityIndicator style={{ flex: 1 }} color={colors.primary} size="large" />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(c) => c.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={s.row}
                onPress={() => {
                  onSelect(item.name, item.phone);
                  onClose();
                }}
              >
                <View style={[s.avatar, { backgroundColor: colors.primary + '22' }]}>
                  <Text style={[s.avatarText, { color: colors.primary }]}>
                    {item.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={s.meta}>
                  <Text style={s.name}>{item.name}</Text>
                  <Text style={s.phone}>{item.phone}</Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={s.empty}>
                <Text style={s.emptyText}>No contacts found</Text>
              </View>
            }
            ItemSeparatorComponent={() => <View style={s.separator} />}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      paddingTop: 56,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: { fontSize: 18, fontWeight: '700', color: colors.text },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      margin: 12,
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
    },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: colors.text },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      gap: 12,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontSize: 16, fontWeight: '700' },
    meta: { flex: 1 },
    name: { fontSize: 15, fontWeight: '600', color: colors.text },
    phone: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
    separator: { height: 1, backgroundColor: colors.border, marginLeft: 68 },
    empty: { alignItems: 'center', paddingTop: 48 },
    emptyText: { fontSize: 14, color: colors.textMuted },
  });
