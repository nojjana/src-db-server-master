import Matter from "matter-js";
import { LobbyController } from "../LobbyController";
import { Program } from "./Program";
import { SaftlimacherBaseProgram } from "./SaftlimacherBaseProgram";

export class CatcherProgram extends SaftlimacherBaseProgram implements Program {

  // world
  private gravityX: number = 0;
  private gravityY: number = 0.4;

  // ingredients
  private availableIngredientTypes = 4;
  private ingredientRadius = 50;
  private ingredientLeft?: Matter.Body;
  private ingredientCenter?: Matter.Body;
  private ingredientRight?: Matter.Body;

  // nets
  private netCollisionRadius = 5;
  private net1?: Matter.Body;
  private net2?: Matter.Body;

  // fields where ingredients fall: left, center, right
  private xLeftField = 740;
  private xCenterField = 1280;
  private xRightField = 1820;

  // floors of nets: bottom, middle
  private yCatcherFieldBottom1 = this.height * 0.8
  private yCatcherFieldMiddle2 = this.height * 0.6

  constructor(lobbyController: LobbyController) {
    super(lobbyController);
  }

  /* -------------------- CATCHER GAME LOOP --------------------*/

  initGameLoop(fps: number) {
    this.gameLoop = setInterval(() => {
      if (this.engine == null || this.net1 == null || this.net2 == null)
        return;
      this.engine.world.gravity.x = this.gravityX;
      this.engine.world.gravity.y = this.gravityY;
      Matter.Engine.update(this.engine, 1000 / fps);

      this.lobbyController.sendToDisplays('catcherNet1Position', [this.net1.position.x, this.net1.position.y]);
      this.lobbyController.sendToDisplays('catcherNet2Position', [this.net2.position.x, this.net2.position.y]);
      this.lobbyController.sendToDisplays('updateScore', this.score);

      if (this.ingredientLeft != null) {
        this.lobbyController.sendToDisplays('updateIngredientLeft', [this.ingredientLeft.position.x, this.ingredientLeft.position.y, 0]);
      }

      if (this.ingredientRight != null) {
        this.lobbyController.sendToDisplays('updateIngredientRight', [this.ingredientRight.position.x, this.ingredientRight.position.y, 1]);
      }

      if (this.ingredientCenter != null) {
        this.lobbyController.sendToDisplays('updateIngredientCenter', [this.ingredientCenter.position.x, this.ingredientCenter.position.y, 2]);
      }

    }, 1000 / fps);
  }

  /* -------------------- CATCHER GAME METHODS --------------------*/

  initLevelData(): void {
    this.initCatcherNets();
    this.initIngredients();
  }

  initIngredients(): void {
    if (this.engine == null) return;

    this.ingredientLeft = Matter.Bodies.circle(
      this.xLeftField,
      -50,
      this.ingredientRadius,
      {
        label: 'Ingredient0'
      });
    Matter.World.add(this.engine.world, this.ingredientLeft);

    this.ingredientRight = Matter.Bodies.circle(
      this.xRightField,
      -600,
      this.ingredientRadius,
      {
        label: 'Ingredient1',
      });
    Matter.World.add(this.engine.world, this.ingredientRight);

    this.ingredientCenter = Matter.Bodies.circle(
      this.xCenterField,
      -1000,
      this.ingredientRadius,
      {
        label: 'Ingredient2',
      });
    Matter.World.add(this.engine.world, this.ingredientCenter);
  }

  initCatcherNets(): void {
    if (this.engine == null) return;

    // net1
    this.net1 = Matter.Bodies.circle(
      this.xCenterField,
      this.yCatcherFieldBottom1,
      this.netCollisionRadius,
      {
        label: 'Catcher1',
        isSensor: true,
        isStatic: true
      });
    Matter.World.add(this.engine.world, this.net1);

    // net2
    this.net2 = Matter.Bodies.circle(
      this.xCenterField,
      this.yCatcherFieldMiddle2,
      this.netCollisionRadius,
      {
        label: 'Catcher2',
        isSensor: true,
        isStatic: true
      });
    Matter.World.add(this.engine.world, this.net2);
  }

  initMatterEventCollision() {
    Matter.Events.on(this.engine, 'collisionStart', (event) => {
      const pairs = event.pairs;

      let i = 0, j = pairs.length;
      for (; i != j; ++i) {
        const pair = pairs[i];

        if (pair.bodyA.label.includes('Catcher') && pair.bodyB.label.includes('Ingredient') || pair.bodyB.label.includes('Catcher') && pair.bodyA.label.includes('Ingredient')) {
          // ingredient catched
          let catcherBody = pair.bodyA;
          let ingredientBody = pair.bodyB;
          if (pair.bodyA.label.includes('Ingredient')) {
            catcherBody = pair.bodyB;
            ingredientBody = pair.bodyA;
          }
          let ingredientTypeNr: number = parseInt(ingredientBody.label.charAt(ingredientBody.label.length - 1));
          let catcherNr: number = parseInt(catcherBody.label.charAt(catcherBody.label.length - 1));

          if (this.allIngredientNumbersOnList.includes(ingredientTypeNr)) {
            // good catch
            this.score += this.scoreInc;
            this.lobbyController.sendToControllers('vibrate', [catcherNr]);
            this.lobbyController.sendToDisplays('checkIngredientOnList', ingredientTypeNr);
            this.lobbyController.sendToDisplays('adjustScoreByCatchedIngredient',
              [this.scoreInc, ingredientTypeNr, ingredientBody.position.x, ingredientBody.position.y]);
          } else if (this.isInedible(ingredientTypeNr)) {
            // beatle iiiih
            this.score -= this.scoreInc * 2;
            this.lobbyController.sendToDisplays('adjustScoreByCatchedIngredient',
              [-(this.scoreInc * 2), ingredientTypeNr, ingredientBody.position.x, ingredientBody.position.y]);
          } else {
            // bad catch
            this.score -= this.scoreInc;
            this.lobbyController.sendToDisplays('adjustScoreByCatchedIngredient',
              [-this.scoreInc, ingredientTypeNr, ingredientBody.position.x, ingredientBody.position.y]);
          }
          this.respawnIngredient(ingredientBody);
        }

        if (pair.bodyA.label === 'Floor' && pair.bodyB.label.includes('Ingredient') || pair.bodyB.label === 'Floor' && pair.bodyB.label.includes('Ingredient')) {
          // ingredient touched the floor -> respawn
          if (pair.bodyB.label.includes('Ingredient')) {
            this.respawnIngredient(pair.bodyB);
          } else {
            this.respawnIngredient(pair.bodyA);
          }
        }
      }
    });
  }

  setControllerDataPlayer1(controllerData: number[]): void {
    let moveToValX = controllerData[0];
    let controllerId = controllerData[1];
    if (moveToValX != null && controllerId != null && this.net1 != undefined) {
      if (controllerId != 1) return;
      // move net1
      this.setNetPos(moveToValX, this.net1);
    }
  }

  setControllerDataPlayer2(controllerData: number[]): void {
    let moveToValX = controllerData[0];
    let controllerId = controllerData[1];
    if (moveToValX != null && controllerId != null && this.net2 != undefined) {
      if (controllerId != 2) return;
      // move net2
      this.setNetPos(moveToValX, this.net2);
    }
  }


  private setNetPos(valX: number, netBody: Matter.Body) {
    if (netBody != undefined && netBody != null) {
      switch (valX) {
        case 1:
          // right
          Matter.Body.setPosition(netBody, { x: this.xRightField, y: netBody.position.y });
          break;
        case -1:
          // left
          Matter.Body.setPosition(netBody, { x: this.xLeftField, y: netBody.position.y });
          break;
        case 0:
          // center
          Matter.Body.setPosition(netBody, { x: this.xCenterField, y: netBody.position.y });
          break;
        default:
          break;
      }
    }
  }

  collectLevelData() {
    let data: any[] = [];

    // 0 -> list
    data.push(this.allIngredientNumbersOnList);
    // 1 2 -> net1
    data.push(this.net1?.position.x);
    data.push(this.net1?.position.y);
    // 3 4 -> net2
    data.push(this.net2?.position.x);
    data.push(this.net2?.position.y);

    return data;
  }

  respawnIngredient(body: Matter.Body) {
    let newNumber = this.getRandomInt(this.availableIngredientTypes);;
    let newlabel = "Ingredient" + newNumber;

    body.label = newlabel;
    Matter.Body.setPosition(body, {
      x: body.position.x,
      y: -500
    });

    switch (body.position.x) {
      case this.xLeftField:
        this.lobbyController.sendToDisplays('changeImageIngredientLeft', [newNumber]);
        break;
      case this.xCenterField:
        this.lobbyController.sendToDisplays('changeImageIngredientCenter', [newNumber]);
        break;
      case this.xRightField:
        this.lobbyController.sendToDisplays('changeImageIngredientRight', [newNumber]);
        break;
      default:
        break;
    }
  }

  clearInGameTimers() {
    // no timers
  }

  createWorldBounds(): void {
    if (this.engine == null) return;

    Matter.World.add(this.engine.world, [
      // Left
      Matter.Bodies.rectangle(this.worldSideMargin, this.height / 2, 10, this.height, {
        isStatic: true
      }),
      // Bottom
      // not visible, further down. trigger for respawning fruit
      Matter.Bodies.rectangle(this.width / 2, this.height + 400, this.width, 10, {
        label: 'Floor',
        isStatic: true,
        isSensor: true
      }),
      // Right
      Matter.Bodies.rectangle(this.width - this.worldSideMargin, this.height / 2, 10, this.height, {
        isStatic: true
      })
    ])
  }

}