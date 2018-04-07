import BaseScene from './BaseScene';
import Controller from '../util/Controller';
import Character from 'objects/Character';
import DOMModal from 'objects/ui/DOMModal';

export default class GameScene extends BaseScene {

  constructor() {
    super({ key: 'GameScene' });

    this.players = new Map();
    this.localCharacter = null;
  }

  init(data) {
    this.characterType = data.character;
    this.playerHandle = data.playerHandle;
  }

  preload() {
    
    //Create collision groups and event handling
    this.projectiles = this.add.group();
    this.characters = this.add.group();
    this.physics.add.overlap(this.projectiles, this.characters, this.localCollision, null, this);


    this.controller = new Controller(this);
    this.input.keyboard.on('keydown_ESC', () => {
      if(this.currentModal) return;
      this.currentModal = new DOMModal(this, 'quitGame', {
        width: 'auto',
        acceptButtonSelector: '.exit',
        cancelButtonSelector: '#stay',
        onAccept: (modal) => {
          modal.close();
          this.currentModal = null;
          this.server.send('leaveGame');
          this.changeToScene('TitleScene');
        },
        onCancel: (modal) => {
          modal.close();
          this.currentModal = null;
        }
      });
    }, this);

    this.input.keyboard.on('keydown_Q', function () {
      //TODO: Toggle leaderboard
    }, this);

    this.input.keyboard.on('keydown_PLUS', function () {
      this.cameras.main.setZoom(this.cameras.main.zoom + 0.1);
    }, this);

    this.input.keyboard.on('keydown_MINUS', function () {
      this.cameras.main.setZoom(this.cameras.main.zoom - 0.1);
    }, this);

    this.input.on('pointerdown', function(event) {
      if(this.localCharacter && event.buttons === 1) {
        let worldX = event.x + event.camera.scrollX * event.camera.zoom;
        let worldY = event.y + event.camera.scrollY * event.camera.zoom;
        if(this.localCharacter.fire(worldX, worldY, this.server.getClientId())) { //Only if we can fire we should notify
          this.server.send('fire', this.localCharacter.x, this.localCharacter.y, worldX, worldY);
        }
      }
    }, this);

    this.map1 = this.add.tilemap('grass_area');
    this.tileset1 = this.map1.addTilesetImage('Map_tileset', 'map_tiles');
    this.layer1 = this.map1.createStaticLayer('Grass Layer', this.tileset1, -800, -600);
  }

  create() {
    this.server.requestEvents();
    this.server.on('serverConnected', this.serverConnected.bind(this));
    this.server.on('existingPlayers', this.existingPlayers.bind(this));
    this.server.on('spawn', this.spawn.bind(this));
    this.server.on('playerJoined', this.playerJoined.bind(this));
    this.server.on('playerLeft', this.playerLeft.bind(this));
    this.server.on('playerMoved', this.playerMoved.bind(this));
    this.server.on('playerFired', this.playerFired.bind(this));
    this.server.on('playerHit', this.playerHit.bind(this));
    this.server.on('playerDied', this.playerDied.bind(this));
    this.server.on('playerDisconnected', this.playerDisconnected.bind(this));
    this.server.on('updateLeaderboard',this.updateLeaderboard.bind(this));
    this.server.send('joinGame', this.characterType, this.playerHandle);
  }

  update() {
    if(this.localCharacter) {
      const vector = this.controller.getWASDVector();
      this.localCharacter.setMotion(vector);
      if(this.localCharacter.shouldBroadcastMotion()) {
        console.log('motion changed locally');
        this.server.send('move', this.localCharacter.x, this.localCharacter.y, vector.x, vector.y);
      }
    }
  }
  
  localCollision(projectile, character) {
    projectile.destroy();
    if(character.hit(projectile.props.damage)) { //If the hit causes the player to die
      this.server.send('die', character.x, character.y, projectile.props.owner.id);
      if(this.currentModal) this.currentModal.close();
      this.currentModal = new DOMModal(this, 'killed', {
        acceptButtonSelector: '#respawn',
        cancelButtonSelector: '.exit',
        onAccept: (modal) => {
          modal.close();
          this.currentModal = null;
          this.server.send('respawn');
        },
        onCancel: (modal) => {
          modal.close();
          this.currentModal = null;
          this.server.send('leaveGame');
          this.changeToScene('TitleScene');
        },
        data: character.stats
      });
      this.localCharacter = null;
    }
    else {
      this.server.send('hit', character.x, character.y, projectile.props.damage, projectile.props.owner.id);
    }
  }

  //WebSocket Messages
  serverConnected() {
    console.log('serverConnected in game scene');
  }


  existingPlayers(existingPlayers) {
    existingPlayers.forEach(value => {
      this.playerJoined(value.id, value.character, value.handle, value.x, value.y);
    });
  }

  spawn(x, y) {
    this.localCharacter = new Character(this, x, y, this.characterType, this.playerHandle);
    this.characters.add(this.localCharacter); //this is us.
    this.cameras.main.startFollow(this.localCharacter);
  }

  playerJoined(id, character, handle, x, y) {
    let remotePlayer = new Character(this, x, y, character, handle);
    this.players.set(id, remotePlayer);
    remotePlayer.id = id;
    //remotePlayer.setHandle(handle);
  }

  playerLeft(id) {
    let player = this.players.get(id);
    if(!player) return;
    player.die();
    this.players.delete(id);
  }

  playerMoved(id, x, y, vecX, vecY) {
    let player = this.players.get(id);
    if(!player) return;
    this.tweens.killTweensOf(player);
    this.tweens.add({
      targets: [player, player.handleText, player.healthBar],
      x: x,
      y: y,
      duration: 50,
      ease: 'Linear'
    });

    //player.setPosition(x, y);
    player.setMotion(new Phaser.Math.Vector2(vecX, vecY), false);
  }

  playerFired(id, fromX, fromY, toX, toY) {
    let player = this.players.get(id);
    if(!player) return;
    this.tweens.killTweensOf(player);
    this.tweens.add({
      targets: [player, player.handleText, player.healthBar],
      x: fromX,
      y: fromY,
      duration: 50,
      ease: 'Linear'
    });
    let projectile = player.fire(toX, toY);
    if(projectile) {
      this.projectiles.add(projectile);
    }
  }
  

  playerHit(id, x, y, damage, hitById) {
    if(hitById == this.server.getClientId()) {
      this.localCharacter.stats.hitsInflicted++; 
    }
    let player = this.players.get(id);
    if(!player) return;
    this.tweens.killTweensOf(player);
    this.tweens.add({
      targets: [player, player.handleText, player.healthBar],
      x: x,
      y: y,
      duration: 50,
      ease: 'Linear'
    });
    if(player.hit(damage)) {
      this.playerDied(id, x, y, hitById);
    }
  }

  playerDied(id, x, y, killedById) {
    if(killedById == this.server.getClientId()) {
      this.localCharacter.stats.kills++; 
    }
    let player = this.players.get(id);
    if(!player) return;
    this.tweens.killTweensOf(player);
    player.die();
    this.players.delete(id);
  }

  playerDisconnected(id) {
    this.tweens.killTweensOf(player);
    let player = this.players.get(id);
    if(!player) return;
    this.tweens.killTweensOf(player);
    this.characters.remove(player);
    this.players.delete(id);
    player.die();
  }

  updateLeaderboard(leaderboard) {
    if(!this.localCharacter) return;
    let index = leaderboard.findIndex(value => value.id == this.server.getClientId());
    if(index > -1) {
      this.localCharacter.stats.highestRanking = leaderboard[index].highestRank;
    }
  }
}