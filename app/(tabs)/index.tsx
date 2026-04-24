import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const STORAGE_KEY = '@mis_huchas_data';

type Hucha = {
  id: string;
  nombre: string;
  meta: number;
  createdAt: string;
};

type Movimiento = {
  id: string;
  huchaId: string;
  tipo: 'ingreso' | 'retirada';
  cantidad: number;
  descripcion: string;
  fecha: string;
};

type AppData = {
  huchas: Hucha[];
  movimientos: Movimiento[];
};

const initialData: AppData = {
  huchas: [],
  movimientos: [],
};

function generateId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export default function HomeScreen() {
  const [data, setData] = useState<AppData>(initialData);
  const [selectedHuchaId, setSelectedHuchaId] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);

  const [newNombre, setNewNombre] = useState('');
  const [newMeta, setNewMeta] = useState('');

  const [moveCantidad, setMoveCantidad] = useState('');
  const [moveDescripcion, setMoveDescripcion] = useState('');
  const [moveTipo, setMoveTipo] = useState<'ingreso' | 'retirada'>('ingreso');

  useEffect(() => {
    loadStoredData();
  }, []);

  async function loadStoredData() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
        setData(initialData);
        return;
      }
      setData(JSON.parse(raw));
    } catch (error) {
      console.error('Error cargando datos', error);
      setData(initialData);
    }
  }

  async function persistData(newData: AppData) {
    try {
      setData(newData);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    } catch (error) {
      console.error('Error guardando datos', error);
    }
  }

  function getSaldoHucha(huchaId: string) {
    return data.movimientos
      .filter((m) => m.huchaId === huchaId)
      .reduce((acc, mov) => {
        return mov.tipo === 'ingreso'
          ? acc + Number(mov.cantidad)
          : acc - Number(mov.cantidad);
      }, 0);
  }

  function getMovimientosHucha(huchaId: string) {
    return data.movimientos.filter((m) => m.huchaId === huchaId);
  }

  function getPorcentajeHucha(hucha: Hucha) {
    const saldo = getSaldoHucha(hucha.id);
    if (!hucha.meta || hucha.meta <= 0) return 0;
    return Math.min((saldo / hucha.meta) * 100, 100);
  }

  const totalAhorrado = useMemo(() => {
    return data.huchas.reduce((acc, hucha) => acc + getSaldoHucha(hucha.id), 0);
  }, [data]);

  const selectedHucha =
    data.huchas.find((h) => h.id === selectedHuchaId) || null;

  function resetCreateForm() {
    setNewNombre('');
    setNewMeta('');
  }

  function resetMoveForm() {
    setMoveCantidad('');
    setMoveDescripcion('');
  }

  async function crearHucha() {
    const meta = Number(String(newMeta).replace(',', '.'));

    if (!newNombre.trim()) {
      Alert.alert('Error', 'Pon un nombre para la hucha');
      return;
    }

    if (Number.isNaN(meta) || meta <= 0) {
      Alert.alert('Error', 'La meta debe ser mayor que 0');
      return;
    }

    const nuevaHucha: Hucha = {
      id: generateId(),
      nombre: newNombre.trim(),
      meta,
      createdAt: new Date().toISOString(),
    };

    const newData: AppData = {
      ...data,
      huchas: [...data.huchas, nuevaHucha],
    };

    await persistData(newData);
    resetCreateForm();
    setShowCreateModal(false);
  }

  function abrirModalMovimiento(tipo: 'ingreso' | 'retirada') {
    setMoveTipo(tipo);
    resetMoveForm();
    setShowMoveModal(true);
  }

  async function guardarMovimiento() {
    if (!selectedHucha) return;

    const cantidad = Number(String(moveCantidad).replace(',', '.'));

    if (Number.isNaN(cantidad) || cantidad <= 0) {
      Alert.alert('Error', 'Introduce una cantidad válida');
      return;
    }

    const saldoActual = getSaldoHucha(selectedHucha.id);

    if (moveTipo === 'retirada' && cantidad > saldoActual) {
      Alert.alert('Error', 'No puedes retirar más dinero del que hay');
      return;
    }

    const nuevoMovimiento: Movimiento = {
      id: generateId(),
      huchaId: selectedHucha.id,
      tipo: moveTipo,
      cantidad,
      descripcion: moveDescripcion.trim(),
      fecha: new Date().toISOString(),
    };

    const newData: AppData = {
      ...data,
      movimientos: [nuevoMovimiento, ...data.movimientos],
    };

    await persistData(newData);
    setShowMoveModal(false);
    resetMoveForm();
  }

  function confirmarEliminarHucha(huchaId: string) {
    Alert.alert(
      'Eliminar hucha',
      'También se borrará su historial. ¿Seguro?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const newData: AppData = {
              huchas: data.huchas.filter((h) => h.id !== huchaId),
              movimientos: data.movimientos.filter((m) => m.huchaId !== huchaId),
            };
            setSelectedHuchaId(null);
            await persistData(newData);
          },
        },
      ]
    );
  }

  function renderCreateModal() {
    return (
      <Modal visible={showCreateModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Nueva hucha</Text>

            <Text style={styles.inputLabel}>Nombre</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Viaje, coche, regalo..."
              value={newNombre}
              onChangeText={setNewNombre}
            />

            <Text style={styles.inputLabel}>Meta</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: 500"
              keyboardType="decimal-pad"
              value={newMeta}
              onChangeText={setNewMeta}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  resetCreateForm();
                  setShowCreateModal(false);
                }}
              >
                <Text style={styles.buttonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.primaryButton]}
                onPress={crearHucha}
              >
                <Text style={styles.buttonText}>Crear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  function renderMoveModal() {
    return (
      <Modal visible={showMoveModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {moveTipo === 'ingreso' ? 'Añadir dinero' : 'Retirar dinero'}
            </Text>

            <Text style={styles.inputLabel}>Cantidad</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: 20"
              keyboardType="decimal-pad"
              value={moveCantidad}
              onChangeText={setMoveCantidad}
            />

            <Text style={styles.inputLabel}>Descripción</Text>
            <TextInput
              style={styles.input}
              placeholder="Opcional"
              value={moveDescripcion}
              onChangeText={setMoveDescripcion}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  resetMoveForm();
                  setShowMoveModal(false);
                }}
              >
                <Text style={styles.buttonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalButton,
                  moveTipo === 'ingreso' ? styles.primaryButton : styles.warningButton,
                ]}
                onPress={guardarMovimiento}
              >
                <Text style={styles.buttonText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  if (selectedHucha) {
    const saldo = getSaldoHucha(selectedHucha.id);
    const porcentaje = getPorcentajeHucha(selectedHucha);
    const movimientos = getMovimientosHucha(selectedHucha.id);

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setSelectedHuchaId(null)}
          >
            <Text style={styles.backText}>← Volver</Text>
          </TouchableOpacity>

          <Text style={styles.title}>{selectedHucha.nombre}</Text>

          <View style={styles.mainCard}>
            <Text style={styles.label}>Saldo actual</Text>
            <Text style={styles.amount}>€{saldo.toFixed(2)}</Text>

            <View style={styles.metaRow}>
              <Text style={styles.metaText}>Meta: €{selectedHucha.meta.toFixed(2)}</Text>
              <Text style={styles.progressText}>{porcentaje.toFixed(0)}%</Text>
            </View>

            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${porcentaje}%` }]} />
            </View>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.bigButton, styles.primaryButton]}
              onPress={() => abrirModalMovimiento('ingreso')}
            >
              <Text style={styles.buttonText}>+ Añadir</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.bigButton, styles.warningButton]}
              onPress={() => abrirModalMovimiento('retirada')}
            >
              <Text style={styles.buttonText}>- Retirar</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.historyHeader}>
            <Text style={styles.sectionTitle}>Historial</Text>
            <TouchableOpacity
              style={styles.deleteSmallButton}
              onPress={() => confirmarEliminarHucha(selectedHucha.id)}
            >
              <Text style={styles.deleteSmallText}>Eliminar</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={movimientos}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Aún no hay movimientos.</Text>
            }
            renderItem={({ item }) => (
              <View style={styles.movementCard}>
                <View style={styles.movementTop}>
                  <Text style={styles.movementType}>
                    {item.tipo === 'ingreso' ? 'Ingreso' : 'Retirada'}
                  </Text>
                  <Text
                    style={[
                      styles.movementAmount,
                      item.tipo === 'ingreso' ? styles.positiveText : styles.negativeText,
                    ]}
                  >
                    {item.tipo === 'ingreso' ? '+' : '-'}€{Number(item.cantidad).toFixed(2)}
                  </Text>
                </View>

                <Text style={styles.movementDesc}>
                  {item.descripcion || 'Sin descripción'}
                </Text>

                <Text style={styles.movementDate}>
                  {new Date(item.fecha).toLocaleString()}
                </Text>
              </View>
            )}
          />
        </View>

        {renderMoveModal()}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.header}>Mis huchas</Text>

        <View style={styles.mainCard}>
          <Text style={styles.label}>Total ahorrado</Text>
          <Text style={styles.amount}>€{totalAhorrado.toFixed(2)}</Text>
        </View>

        <TouchableOpacity
          style={[styles.newHuchaButton, styles.primaryButton]}
          onPress={() => setShowCreateModal(true)}
        >
          <Text style={styles.newHuchaText}>+ Crear nueva hucha</Text>
        </TouchableOpacity>

        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>Tus huchas</Text>
          <Text style={styles.counterText}>{data.huchas.length}</Text>
        </View>

        <FlatList
          data={data.huchas}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              No hay huchas todavía. Crea la primera.
            </Text>
          }
          renderItem={({ item }) => {
            const saldo = getSaldoHucha(item.id);
            const porcentaje = getPorcentajeHucha(item);

            return (
              <TouchableOpacity
                style={styles.huchaCard}
                onPress={() => setSelectedHuchaId(item.id)}
                activeOpacity={0.85}
              >
                <View style={styles.huchaTop}>
                  <Text style={styles.huchaTitle}>{item.nombre}</Text>
                  <Text style={styles.chevron}>›</Text>
                </View>

                <Text style={styles.cardAmount}>€{saldo.toFixed(2)}</Text>

                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>Meta: €{item.meta.toFixed(2)}</Text>
                  <Text style={styles.progressText}>{porcentaje.toFixed(0)}%</Text>
                </View>

                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${porcentaje}%` }]} />
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {renderCreateModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F1F7',
  },

  content: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 18,
  },

  header: {
    fontSize: 32,
    fontWeight: '900',
    color: '#1805A6',
    marginBottom: 16,
  },

  title: {
    fontSize: 30,
    fontWeight: '900',
    color: '#111',
    marginBottom: 16,
  },

  mainCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#111',
  },

  label: {
    fontSize: 15,
    fontWeight: '800',
    color: '#555',
    marginBottom: 6,
  },

  amount: {
    fontSize: 42,
    fontWeight: '900',
    color: '#111',
  },

  cardAmount: {
    fontSize: 30,
    fontWeight: '900',
    color: '#111',
    marginTop: 6,
  },

  sectionTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111',
  },

  newHuchaButton: {
    minHeight: 58,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },

  newHuchaText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111',
  },

  primaryButton: {
    backgroundColor: '#DDF46A',
  },

  warningButton: {
    backgroundColor: '#F3C7C0',
  },

  cancelButton: {
    backgroundColor: '#EDEAF2',
  },

  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 22,
  },

  bigButton: {
    flex: 1,
    minHeight: 60,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },

  buttonText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#111',
  },

  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#111',
    backgroundColor: '#BFE7D3',
    marginBottom: 14,
  },

  backText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111',
  },

  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  counterText: {
    marginLeft: 8,
    fontSize: 18,
    fontWeight: '900',
    color: '#1805A6',
  },

  listContent: {
    paddingBottom: 24,
  },

  huchaCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: '#111',
  },

  huchaTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  huchaTitle: {
    flex: 1,
    fontSize: 23,
    fontWeight: '900',
    color: '#111',
  },

  chevron: {
    fontSize: 34,
    fontWeight: '700',
    color: '#111',
    marginLeft: 10,
  },

  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },

  metaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },

  progressText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111',
  },

  progressBarBg: {
    width: '100%',
    height: 14,
    backgroundColor: '#E8E8E8',
    borderRadius: 20,
    marginTop: 10,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#111',
  },

  progressBarFill: {
    height: '100%',
    backgroundColor: '#111',
  },

  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  deleteSmallButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#111',
    backgroundColor: '#E8A8A8',
  },

  deleteSmallText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#111',
  },

  movementCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#111',
    borderRadius: 18,
    padding: 15,
    marginBottom: 12,
  },

  movementTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  movementType: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111',
  },

  movementAmount: {
    fontSize: 22,
    fontWeight: '900',
  },

  positiveText: {
    color: '#126B35',
  },

  negativeText: {
    color: '#A32020',
  },

  movementDesc: {
    fontSize: 16,
    color: '#333',
    marginTop: 6,
  },

  movementDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
  },

  emptyText: {
    fontSize: 16,
    color: '#555',
    marginTop: 12,
    lineHeight: 22,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 20,
  },

  modalBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#111',
    borderRadius: 24,
    padding: 20,
  },

  modalTitle: {
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 18,
    color: '#111',
  },

  inputLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#333',
    marginBottom: 6,
  },

  input: {
    borderWidth: 2,
    borderColor: '#111',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    fontSize: 18,
    marginBottom: 14,
    backgroundColor: '#FAFAFA',
  },

  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },

  modalButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
});