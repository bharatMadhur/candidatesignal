#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

require_confirmation

gcloud compute firewall-rules describe candidatesignal-allow-http >/dev/null 2>&1 \
  || gcloud compute firewall-rules create candidatesignal-allow-http \
    --allow=tcp:80,tcp:443 \
    --target-tags=candidatesignal-app \
    --description="Allow HTTP/HTTPS to candidateSignal app VM"

gcloud compute instances describe "${VM_NAME}" --zone="${ZONE}" >/dev/null 2>&1 \
  || gcloud compute instances create "${VM_NAME}" \
    --zone="${ZONE}" \
    --machine-type="${VM_MACHINE_TYPE}" \
    --service-account="$(service_account_email "${VM_SERVICE_ACCOUNT}")" \
    --scopes=cloud-platform \
    --tags=candidatesignal-app \
    --boot-disk-size="${VM_BOOT_DISK_SIZE}" \
    --image-family=debian-12 \
    --image-project=debian-cloud \
    --metadata=startup-script='#!/usr/bin/env bash
set -euxo pipefail
apt-get update
apt-get install -y ca-certificates curl gnupg git
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
mkdir -p /opt/candidatesignal
'

echo "VM ready."
echo "Name: ${VM_NAME}"
echo "Zone: ${ZONE}"
echo "SSH: gcloud compute ssh ${VM_NAME} --zone=${ZONE}"
