import {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {KineticHeader, SegmentedControl, spacing} from '../../../../shared/ui';
import type {HttpCourierApplicationGateway} from '../../../courier-applications/infrastructure/httpCourierApplicationGateway';
import {AdminApplicationsPanel} from '../../../courier-applications/presentation/components/AdminApplicationsPanel';
import type {HttpAuthGateway} from '../../infrastructure/httpAuthGateway';
import {AdminUsersPanel} from './AdminUsersPanel';

interface AdminAccessScreenProps {
  readonly authGateway: HttpAuthGateway;
  readonly applicationGateway: HttpCourierApplicationGateway;
}

export function AdminAccessScreen({
  authGateway,
  applicationGateway,
}: AdminAccessScreenProps) {
  const [section, setSection] = useState<'users' | 'applications'>('users');

  return (
    <View style={styles.container}>
      <KineticHeader title="Accesos y postulaciones" />
      <SegmentedControl<'users' | 'applications'>
        onChange={setSection}
        options={[
          {value: 'users', label: 'Usuarios'},
          {value: 'applications', label: 'Solicitudes'},
        ]}
        value={section}
      />
      {section === 'users' ? (
        <AdminUsersPanel gateway={authGateway} />
      ) : (
        <AdminApplicationsPanel gateway={applicationGateway} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
});
