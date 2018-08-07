const Promise       =      require('bluebird');
const _             =      require('underscore');
const child_process =      Promise.promisifyAll(require('child_process'));
const conf          =      require('../../modules/configstore');
const download      =      require('download');
const fs            =      require('fs-extra');
const os            =      require('os');
const path          =      require('path');
const Provider      =      require('./provider');
const Spinner       =      require('../../modules/spinner');
const spinnerDot    =      conf.get('spinnerDot');
const Ssh           =      require('../ssh');
const yaml          =      require('js-yaml');

const vbox          =      require('node-virtualbox');
const {boxes, bakeletsPath, remotesPath, configPath, privateKey, bakerSSHConfig} = require('../../../global-vars');


class RuncProvider extends Provider {
    constructor() {
        super();

        this.driver = this;
    }

    /**
     * Prune
     */
    static async prune() {
    }

    async list() {
    }

    /**
     * Starts a VM by name
     * @param {String} VMName Name of the VM to be started
     * @param {boolean} verbose
     */
    async start(VMName, verbose = false) {
    }

    /**
     * Shut down a VM by name
     * @param {String} VMName Name of the VM to be halted
     * TODO: add force option
     */
    async stop(VMName, force = false) {
    }

    /**
     * Destroy VM
     * @param {String} VMName
     */
    async delete(VMName) {
    }

    /**
     * Get ssh configurations
     * @param {Obj} machine
     * @param {Obj} nodeName Optionally give name of machine when multiple machines declared in single Vagrantfile.
     */
    async getSSHConfig(machine, nodeName) {

        // Use VirtualBox driver
        let vmInfo = await this.driver.info(machine);
        let port = null;
        Object.keys(vmInfo).forEach(key => {
            if(vmInfo[key].includes('guestssh')){
                port = parseInt( vmInfo[key].split(',')[3]);
            }
        });
        return {user: 'vagrant', port: port, host: machine, hostname: '127.0.0.1', private_key: privateKey};
    }

    /**
     * Returns State of a VM
     * @param {String} VMName
     */
    async getState(VMName) {
    }

    /**
     * It will ssh to the vagrant box
     * @param {String} name
     */
    async ssh(name) {
        await this.sshChroot(name);
    }

    async sshRunc (name) {
        try {
            let cmd = 'cd /mnt/disk/demo && runc run --no-pivot instance-0';
            child_process.execSync(`ssh -i ${privateKey} -o StrictHostKeyChecking=no -o IdentitiesOnly=yes -p 6022 root@127.0.0.1 -t "${cmd}"`,  {stdio: ['inherit', 'inherit', 'ignore']});
        } catch(err) {
            throw err;
        }
    }

    async sshChroot(name) {
        try {
            let bakerPath = `/home/vagrant/baker/${name}`
            let cmd = `cd ${bakerPath} && chroot ${bakerPath}/rootfs /bin/bash`;
            child_process.execSync(`ssh -i ${privateKey} -o StrictHostKeyChecking=no -o IdentitiesOnly=yes -p 6022 root@127.0.0.1 -t "${cmd}"`,  {stdio: ['inherit', 'inherit', 'ignore']});
        } catch(err) {
            throw err;
        }
    }

    async bake(scriptPath, ansibleSSHConfig, verbose) {
        await this.bakeChroot(scriptPath, ansibleSSHConfig, verbose);
    }

    async bakeRunc(scriptPath, ansibleSSHConfig, verbose) {
        var cmd = 'mkdir -p /mnt/disk/demo/rootfs; tar -xf /data/boxes/rootfs.tar -C /mnt/disk/demo/rootfs; cd /mnt/disk/demo && runc spec';
        await Ssh.sshExec(cmd, ansibleSSHConfig, 60000, verbose);
    }

    async bakeChroot(scriptPath, ansibleSSHConfig, verbose) {
        let boxesPath = path.join(boxes, 'boxes');
        if (! (await fs.exists(path.join(boxesPath, 'rootfs.tar')))) {
            await Spinner.spinPromise(download('https://github.com/ottomatica/baker-release/releases/download/0.6.1/rootfs.tar', boxesPath), 'Downloading Ubuntu 16.04 rootfs', spinnerDot);
        }

        let doc = yaml.safeLoad(await fs.readFile(path.join(scriptPath, 'baker.yml'), 'utf8'));
        let bakerPath = `/home/vagrant/baker/${doc.name}`
        let rootfsPath = `${bakerPath}/rootfs`;
        var cmd = `mkdir -p ${rootfsPath}; tar -xf /share/Users/${os.userInfo().username}/.baker/boxes/rootfs.tar -C ${rootfsPath}; echo 'nameserver 8.8.4.4' | tee -a ${rootfsPath}/etc/resolv.conf; mkdir -p ${rootfsPath}/${doc.name}; mount --bind /share${scriptPath} ${rootfsPath}/${doc.name}`;
        await Ssh.sshExec(cmd, ansibleSSHConfig, 60000, verbose);
    }

    static async retrieveSSHConfigByName(name) {
        let vmSSHConfigUser = await this.getSSHConfig(name);
        return vmSSHConfigUser;
    }

}

module.exports = RuncProvider;