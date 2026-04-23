import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
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
            <Text style={styles.buttonText}>← VOLVER</Text>
          </TouchableOpacity>

          <Text style={styles.title}>{selectedHucha.nombre.toUpperCase()}</Text>

          <View style={styles.card}>
            <Text style={styles.label}>SALDO ACTUAL</Text>
            <Text style={styles.amount}>€{saldo.toFixed(2)}</Text>

            <Text style={[styles.label, { marginTop: 16 }]}>META</Text>
            <Text style={styles.metaText}>€{selectedHucha.meta.toFixed(2)}</Text>

            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${porcentaje}%` }]} />
            </View>

            <Text style={styles.progressText}>{porcentaje.toFixed(0)}% completado</Text>
          </View>

          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.actionButton, styles.greenButton]}
              onPress={() => abrirModalMovimiento('ingreso')}
            >
              <Text style={styles.buttonText}>+ AÑADIR</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.redButton]}
              onPress={() => abrirModalMovimiento('retirada')}
            >
              <Text style={styles.buttonText}>- RETIRAR</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton, { marginTop: 12 }]}
            onPress={() => confirmarEliminarHucha(selectedHucha.id)}
          >
            <Text style={styles.buttonText}>ELIMINAR HUCHA</Text>
          </TouchableOpacity>

          <Text style={[styles.sectionTitle, { marginTop: 24, marginBottom: 12 }]}>
            HISTORIAL
          </Text>

          <FlatList
            data={movimientos}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={<Text style={styles.emptyText}>No hay movimientos todavía</Text>}
            renderItem={({ item }) => (
              <View style={styles.movementCard}>
                <Text style={styles.movementType}>
                  {item.tipo === 'ingreso' ? 'INGRESO' : 'RETIRADA'}
                </Text>
                <Text style={styles.movementAmount}>
                  {item.tipo === 'ingreso' ? '+' : '-'}€{Number(item.cantidad).toFixed(2)}
                </Text>
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

        <Modal visible={showMoveModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>
                {moveTipo === 'ingreso' ? 'AÑADIR DINERO' : 'RETIRAR DINERO'}
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Cantidad"
                keyboardType="decimal-pad"
                value={moveCantidad}
                onChangeText={setMoveCantidad}
              />

              <TextInput
                style={styles.input}
                placeholder="Descripción opcional"
                value={moveDescripcion}
                onChangeText={setMoveDescripcion}
              />

              <View style={styles.row}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.redButton]}
                  onPress={() => setShowMoveModal(false)}
                >
                  <Text style={styles.buttonText}>CANCELAR</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.greenButton]}
                  onPress={guardarMovimiento}
                >
                  <Text style={styles.buttonText}>CONFIRMAR</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.header}>MIS HUCHAS</Text>

        <View style={styles.card}>
          <Text style={styles.label}>TOTAL AHORRADO</Text>
          <Text style={styles.amount}>€{totalAhorrado.toFixed(2)}</Text>
        </View>

        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>TUS HUCHAS ({data.huchas.length})</Text>
          <TouchableOpacity
            style={[styles.smallButton, styles.greenButton]}
            onPress={() => setShowCreateModal(true)}
          >
            <Text style={styles.buttonText}>+ NUEVA</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={data.huchas}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={styles.emptyText}>No hay huchas todavía</Text>}
          renderItem={({ item }) => {
            const saldo = getSaldoHucha(item.id);
            const porcentaje = getPorcentajeHucha(item);

            return (
              <TouchableOpacity style={styles.card} onPress={() => setSelectedHuchaId(item.id)}>
                <Text style={styles.huchaTitle}>{item.nombre.toUpperCase()}</Text>
                <Text style={styles.amount}>€{saldo.toFixed(2)}</Text>
                <Text style={styles.metaText}>Meta: €{item.meta.toFixed(2)}</Text>

                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${porcentaje}%` }]} />
                </View>

                <Text style={styles.progressText}>{porcentaje.toFixed(0)}% completado</Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <Modal visible={showCreateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>NUEVA HUCHA</Text>

            <TextInput
              style={styles.input}
              placeholder="Nombre de la hucha"
              value={newNombre}
              onChangeText={setNewNombre}
            />

            <TextInput
              style={styles.input}
              placeholder="Meta"
              keyboardType="decimal-pad"
              value={newMeta}
              onChangeText={setNewMeta}
            />

            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.actionButton, styles.redButton]}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={styles.buttonText}>CANCELAR</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.greenButton]}
                onPress={crearHucha}
              >
                <Text style={styles.buttonText}>CREAR</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f1ed',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  header: {
    fontSize: 34,
    fontWeight: '900',
    color: '#111',
    marginBottom: 20,
  },
  title: {
    fontSize: 34,
    fontWeight: '900',
    color: '#111',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111',
  },
  card: {
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#111',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
  },
  label: {
    fontSize: 15,
    fontWeight: '800',
    color: '#222',
    marginBottom: 6,
  },
  amount: {
    fontSize: 28,
    fontWeight: '900',
    color: '#111',
  },
  metaText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginTop: 6,
  },
  progressBarBg: {
    width: '100%',
    height: 14,
    backgroundColor: '#e5e5e5',
    borderRadius: 10,
    marginTop: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#111',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#111',
  },
  progressText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#111',
    alignItems: 'center',
  },
  smallButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#111',
    alignItems: 'center',
  },
  greenButton: {
    backgroundColor: '#bfe7d3',
  },
  redButton: {
    backgroundColor: '#f3c7c0',
  },
  deleteButton: {
    backgroundColor: '#e8a8a8',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111',
  },
  emptyText: {
    fontSize: 16,
    color: '#444',
    marginTop: 12,
  },
  huchaTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111',
    marginBottom: 10,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#111',
    backgroundColor: '#bfe7d3',
    marginBottom: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 20,
  },
  modalBox: {
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#111',
    borderRadius: 20,
    padding: 20,
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 20,
    color: '#111',
  },
  input: {
    borderWidth: 3,
    borderColor: '#111',
    borderRadius: 14,
    padding: 14,
    fontSize: 18,
    marginBottom: 14,
    backgroundColor: '#fafafa',
  },
  movementCard: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#111',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  movementType: {
    fontSize: 14,
    fontWeight: '900',
    color: '#111',
  },
  movementAmount: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111',
    marginTop: 4,
  },
  movementDesc: {
    fontSize: 16,
    color: '#333',
    marginTop: 6,
  },
  movementDate: {
    fontSize: 12,
    color: '#555',
    marginTop: 6,
  },
});